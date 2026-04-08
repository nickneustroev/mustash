import type { AppStateRepository, ArchiveRepository } from "../../persistence/types.js";
import type { SavedTrackItem } from "../../shared/types.js";
import { SpotifyRateLimitError } from "../../shared/errors.js";
import type { Logger } from "../../shared/types.js";
import type { SpotifyClient } from "../../spotify/spotify-client.js";
import type { AutoPlaylistDefinition } from "./auto-playlist-definition.js";
import {
  filterSavedTracks,
  type SavedTracksFetchRequirements,
  type SavedTracksSource,
} from "./saved-tracks-source.js";

export interface AutoPlaylistsSyncOptions {
  definitions: AutoPlaylistDefinition[];
  syncIntervalMs: number;
  playlistPrivate: boolean;
  syncModeName: string;
  syncRemovedTracksArchive?: boolean;
  savedTracksRequirements?: SavedTracksFetchRequirements;
}

interface SavedTrackSnapshotItem {
  trackId: string;
  trackUri: string;
  trackName: string | null;
  artistName: string | null;
  addedAtIso: string;
}

const SAVED_TRACKS_SNAPSHOT_KEY = "auto_playlists:saved_tracks_snapshot";
const PLAYLIST_ID_KEY_PREFIX = "auto_playlists:playlist_id:";

export class AutoPlaylistsSyncService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = true;
  private nextAllowedSyncAtEpochMs = 0;
  private readonly playlistIdsByDefinitionKey = new Map<string, string>();
  private readonly lastHashesByDefinitionKey = new Map<string, string>();

  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly savedTracksSource: SavedTracksSource,
    private readonly archiveRepository: ArchiveRepository,
    private readonly appStateRepository: AppStateRepository,
    private readonly logger: Logger,
    private readonly options: AutoPlaylistsSyncOptions,
  ) {}

  public start(): void {
    if (this.options.definitions.length === 0) {
      this.logger.warn("No playlist definitions are configured.");
      return;
    }

    this.stopped = false;
    void this.syncNow();
    this.timer = setInterval(() => {
      void this.syncNow();
    }, this.options.syncIntervalMs);
    this.logger.info(
      `Sync started (${this.options.syncModeName}, definitions=${this.options.definitions.length}, interval=${this.options.syncIntervalMs}ms).`,
    );
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info(`Sync stopped (${this.options.syncModeName}).`);
  }

  public async syncNow(): Promise<void> {
    if (this.stopped || this.running) {
      return;
    }
    if (Date.now() < this.nextAllowedSyncAtEpochMs) {
      return;
    }

    this.running = true;
    try {
      this.logger.info(`Sync cycle started (${this.options.syncModeName}).`);
      await this.ensurePlaylists();
      const savedTracks = await this.savedTracksSource.getSavedTracks(this.options.savedTracksRequirements);

      if (this.options.syncRemovedTracksArchive) {
        await this.syncRemovedTracksArchive(savedTracks);
      }

      let syncedPlaylists = 0;

      for (const definition of this.options.definitions) {
        const playlistId = this.playlistIdsByDefinitionKey.get(definition.key);
        if (!playlistId) {
          continue;
        }

        const trackUris = definition.resolveTrackUris(savedTracks);
        const hash = hashTrackUris(trackUris);
        if (this.lastHashesByDefinitionKey.get(definition.key) === hash) {
          continue;
        }

        try {
          await this.spotifyClient.replacePlaylistItems(playlistId, trackUris);
        } catch (error) {
          if (isMissingPlaylistError(error)) {
            await this.forgetPlaylistId(definition.key);
            this.lastHashesByDefinitionKey.delete(definition.key);
            this.logger.warn(
              `Playlist "${definition.playlistName}" is no longer available. Cached id dropped, will recreate on next sync.`,
            );
            continue;
          }

          throw error;
        }

        this.lastHashesByDefinitionKey.set(definition.key, hash);
        syncedPlaylists += 1;
        this.logger.info(`Synced "${definition.playlistName}" - ${trackUris.length} items.`);
      }

      this.logger.info(
        `Sync cycle completed (${this.options.syncModeName}, updated=${syncedPlaylists}/${this.options.definitions.length}).`,
      );
    } catch (error) {
      if (error instanceof SpotifyRateLimitError) {
        this.nextAllowedSyncAtEpochMs = Date.now() + error.retryAfterSeconds * 1000;
        this.logger.warn(
          `Sync rate-limited. Retry after ${error.retryAfterSeconds}s. Next attempt after ${new Date(this.nextAllowedSyncAtEpochMs).toISOString()}.`,
        );
      } else {
        this.logger.warn(`Sync failed (${this.options.syncModeName}): ${(error as Error).message}`);
      }
    } finally {
      this.running = false;
    }
  }

  private async ensurePlaylists(): Promise<void> {
    const userId = await this.spotifyClient.getCurrentUserId();

    for (const definition of this.options.definitions) {
      if (this.playlistIdsByDefinitionKey.has(definition.key)) {
        continue;
      }

      const cachedPlaylistId = await this.readPlaylistId(definition.key);
      if (cachedPlaylistId) {
        this.playlistIdsByDefinitionKey.set(definition.key, cachedPlaylistId);
        continue;
      }

      const existing = await this.spotifyClient.findPlaylistByName(definition.playlistName);
      if (existing) {
        await this.rememberPlaylistId(definition.key, existing.id);
        continue;
      }

      const created = await this.spotifyClient.createPlaylist(
        userId,
        definition.playlistName,
        definition.playlistDescription,
        this.options.playlistPrivate,
      );
      await this.rememberPlaylistId(definition.key, created.id);
      this.logger.info(`Created (${definition.playlistName}).`);

      if (!definition.buildCoverJpeg) {
        continue;
      }

      try {
        const coverJpeg = await definition.buildCoverJpeg();
        await this.spotifyClient.uploadPlaylistCoverImage(created.id, coverJpeg.toString("base64"));
        this.logger.info(`Cover uploaded (${definition.playlistName}).`);
      } catch (error) {
        this.logger.warn(
          `Failed to upload cover for playlist ${definition.playlistName}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async syncRemovedTracksArchive(currentSavedTracks: SavedTrackItem[]): Promise<void> {
    const previousSnapshot = await this.readSavedTracksSnapshot();
    if (previousSnapshot.length > 0) {
      const currentTrackIds = new Set(currentSavedTracks.map((track) => track.trackId));
      const now = new Date();

      for (const track of previousSnapshot) {
        if (currentTrackIds.has(track.trackId)) {
          continue;
        }

        const existingArchive = await this.archiveRepository.getArchivedTrack(track.trackId);
        if (existingArchive) {
          continue;
        }

        await this.archiveRepository.upsertArchivedTrack({
          trackId: track.trackId,
          trackUri: track.trackUri,
          trackName: track.trackName,
          artistName: track.artistName,
          addedAt: track.addedAt,
          removedAt: now,
        });
        this.logger.info(
          `Archived removed track: ${track.artistName ?? "Unknown artist"} - ${track.trackName ?? track.trackId} (${track.trackId}).`,
        );
      }
    }

    await this.writeSavedTracksSnapshot(currentSavedTracks);
  }

  private async readSavedTracksSnapshot(): Promise<SavedTrackItem[]> {
    const raw = await this.appStateRepository.getValue(SAVED_TRACKS_SNAPSHOT_KEY);
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as SavedTrackSnapshotItem[];
      return parsed
        .map((item) => ({
          trackId: item.trackId,
          trackUri: item.trackUri,
          trackName: item.trackName,
          artistName: item.artistName,
          addedAt: new Date(item.addedAtIso),
        }))
        .filter((item) => !Number.isNaN(item.addedAt.getTime()));
    } catch {
      this.logger.warn("Saved tracks snapshot in AppState is invalid. Rebuilding snapshot.");
      return [];
    }
  }

  private async writeSavedTracksSnapshot(savedTracks: SavedTrackItem[]): Promise<void> {
    const payload = JSON.stringify(
      savedTracks.map((track) => ({
        trackId: track.trackId,
        trackUri: track.trackUri,
        trackName: track.trackName,
        artistName: track.artistName,
        addedAtIso: track.addedAt.toISOString(),
      } satisfies SavedTrackSnapshotItem)),
    );

    await this.appStateRepository.setValue(SAVED_TRACKS_SNAPSHOT_KEY, payload);
  }

  private async readPlaylistId(definitionKey: string): Promise<string | null> {
    const raw = await this.appStateRepository.getValue(buildPlaylistIdStateKey(definitionKey));
    return raw && raw.trim().length > 0 ? raw : null;
  }

  private async rememberPlaylistId(definitionKey: string, playlistId: string): Promise<void> {
    this.playlistIdsByDefinitionKey.set(definitionKey, playlistId);
    await this.appStateRepository.setValue(buildPlaylistIdStateKey(definitionKey), playlistId);
  }

  private async forgetPlaylistId(definitionKey: string): Promise<void> {
    this.playlistIdsByDefinitionKey.delete(definitionKey);
    await this.appStateRepository.deleteValue(buildPlaylistIdStateKey(definitionKey));
  }
}

export function hashTrackUris(trackUris: string[]): string {
  return `${trackUris.length}:${trackUris.join("|")}`;
}

function buildPlaylistIdStateKey(definitionKey: string): string {
  return `${PLAYLIST_ID_KEY_PREFIX}${definitionKey}`;
}

function isMissingPlaylistError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("Spotify request failed (404)") || error.message.includes("Spotify request failed (403)"))
  );
}

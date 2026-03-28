import { SpotifyRateLimitError } from "../../shared/errors.js";
import type { Logger } from "../../shared/types.js";
import type { SpotifyClient } from "../../spotify/spotify-client.js";
import type { AutoPlaylistDefinition } from "./auto-playlist-definition.js";
import type { SavedTracksFetchRequirements, SavedTracksSource } from "./saved-tracks-source.js";

export interface AutoPlaylistsSyncOptions {
  definitions: AutoPlaylistDefinition[];
  syncIntervalMs: number;
  playlistPrivate: boolean;
  savedTracksRequirements?: SavedTracksFetchRequirements;
}

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
    private readonly logger: Logger,
    private readonly options: AutoPlaylistsSyncOptions,
  ) {}

  public start(): void {
    if (this.options.definitions.length === 0) {
      this.logger.warn("Auto playlists are enabled but no playlist definitions are configured.");
      return;
    }

    this.stopped = false;
    void this.syncNow();
    this.timer = setInterval(() => {
      void this.syncNow();
    }, this.options.syncIntervalMs);
    this.logger.info(
      `Auto playlists sync started (definitions=${this.options.definitions.length}, interval=${this.options.syncIntervalMs}ms).`,
    );
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Auto playlists sync stopped.");
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
      await this.ensurePlaylists();
      const savedTracks = await this.savedTracksSource.getSavedTracks(this.options.savedTracksRequirements);

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

        await this.spotifyClient.replacePlaylistItems(playlistId, trackUris);
        this.lastHashesByDefinitionKey.set(definition.key, hash);
        this.logger.info(`Auto playlist synced (${definition.playlistName}, ${trackUris.length} items).`);
      }
    } catch (error) {
      if (error instanceof SpotifyRateLimitError) {
        this.nextAllowedSyncAtEpochMs = Date.now() + error.retryAfterSeconds * 1000;
        this.logger.warn(
          `Auto playlists sync rate-limited. Retry after ${error.retryAfterSeconds}s. Next attempt after ${new Date(this.nextAllowedSyncAtEpochMs).toISOString()}.`,
        );
      } else {
        this.logger.warn(`Auto playlists sync failed: ${(error as Error).message}`);
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

      const existing = await this.spotifyClient.findPlaylistByName(definition.playlistName);
      if (existing) {
        this.playlistIdsByDefinitionKey.set(definition.key, existing.id);
        continue;
      }

      const created = await this.spotifyClient.createPlaylist(
        userId,
        definition.playlistName,
        definition.playlistDescription,
        this.options.playlistPrivate,
      );
      this.playlistIdsByDefinitionKey.set(definition.key, created.id);
      this.logger.info(`Auto playlist created (${definition.playlistName}).`);

      if (!definition.buildCoverJpeg) {
        continue;
      }

      try {
        const coverJpeg = await definition.buildCoverJpeg();
        await this.spotifyClient.uploadPlaylistCoverImage(created.id, coverJpeg.toString("base64"));
        this.logger.info(`Auto playlist cover uploaded (${definition.playlistName}).`);
      } catch (error) {
        this.logger.warn(
          `Failed to upload cover for playlist ${definition.playlistName}: ${(error as Error).message}`,
        );
      }
    }
  }
}

export function hashTrackUris(trackUris: string[]): string {
  return `${trackUris.length}:${trackUris.join("|")}`;
}

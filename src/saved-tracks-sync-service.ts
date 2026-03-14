import { SpotifyRateLimitError } from "./errors.js";
import type { Logger, SavedTrackItem, ArchivedTrackItem } from "./types.js";
import type { SpotifyClient } from "./spotify-client.js";
import type { SavedTrackRepository } from "./saved-track-repository.js";
import type { ArchiveRepository } from "./archive-repository.js";

export interface SavedTracksSyncOptions {
  syncIntervalMs: number;
}

export class SavedTracksSyncService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = true;

  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly repository: SavedTrackRepository,
    private readonly archiveRepository: ArchiveRepository,
    private readonly logger: Logger,
    private readonly options: SavedTracksSyncOptions,
  ) {}

  public start(): void {
    this.stopped = false;
    void this.syncNow();
    this.timer = setInterval(() => {
      void this.syncNow();
    }, this.options.syncIntervalMs);
    this.logger.info(`Saved tracks sync started (interval=${this.options.syncIntervalMs}ms).`);
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Saved tracks sync stopped.");
  }

  public async syncNow(): Promise<void> {
    if (this.stopped || this.running) {
      return;
    }

    this.running = true;
    try {
      const dbTrackIds = await this.repository.getAllSavedTrackIds();
      const dbTrackIdSet = new Set(dbTrackIds);
      const dbCount = dbTrackIds.length;

      // Fetch all tracks from Spotify
      const allSpotifyTracks: SavedTrackItem[] = [];
      let offset = 0;
      const pageSize = 50;

      while (true) {
        const page = await this.spotifyClient.getSavedTracksPage(pageSize, offset);
        allSpotifyTracks.push(...page.tracks);

        if (page.tracks.length < pageSize || allSpotifyTracks.length >= page.total) {
          break;
        }
        offset += pageSize;
      }

      const spotifyTrackIdSet = new Set(allSpotifyTracks.map((t) => t.trackId));
      const spotifyCount = allSpotifyTracks.length;

      // Find new tracks (in Spotify but not in DB)
      const newTracks = allSpotifyTracks.filter((t) => !dbTrackIdSet.has(t.trackId));

      // Find removed tracks (in DB but not in Spotify)
      const removedTrackIds = dbTrackIds.filter((id) => !spotifyTrackIdSet.has(id));

      // Find tracks that need metadata update
      const existingTracksInSpotify = allSpotifyTracks.filter((t) => dbTrackIdSet.has(t.trackId));
      const tracksToUpdate: SavedTrackItem[] = [];

      // We need to compare with DB to find changed metadata
      const existingDbTracks = await this.repository.getAllSavedTracks();
      const dbTracksMap = new Map(existingDbTracks.map((t) => [t.trackId, t]));

      for (const spotifyTrack of existingTracksInSpotify) {
        const dbTrack = dbTracksMap.get(spotifyTrack.trackId);
        if (dbTrack) {
          // Check if metadata changed
          if (
            dbTrack.trackName !== spotifyTrack.trackName ||
            dbTrack.artistName !== spotifyTrack.artistName ||
            dbTrack.addedAtEpochMs !== spotifyTrack.addedAtEpochMs
          ) {
            tracksToUpdate.push(spotifyTrack);
          }
        }
      }

      // Perform operations
      let newCount = 0;
      let updatedCount = 0;
      let removedCount = 0;

      if (newTracks.length > 0) {
        newCount = await this.repository.upsertSavedTracks(newTracks);
      }

      if (tracksToUpdate.length > 0) {
        updatedCount = await this.repository.upsertSavedTracks(tracksToUpdate);
      }

      if (removedTrackIds.length > 0) {
        removedCount = await this.archiveAndDeleteTracks(removedTrackIds, dbTracksMap);
      }

      this.logger.info(
        `Saved tracks synced: Spotify=${spotifyCount}, DB=${dbCount}, new=${newCount}, updated=${updatedCount}, removed=${removedCount}.`,
      );
    } catch (error) {
      if (error instanceof SpotifyRateLimitError) {
        this.logger.warn(
          `Saved tracks sync rate-limited. Retry after ${error.retryAfterSeconds}s on next interval.`,
        );
      } else {
        this.logger.warn(`Saved tracks sync failed: ${(error as Error).message}`);
      }
    } finally {
      this.running = false;
    }
  }

  private async archiveAndDeleteTracks(
    removedTrackIds: string[],
    dbTracksMap: Map<string, SavedTrackItem>,
  ): Promise<number> {
    let removedCount = 0;
    const now = Date.now();

    for (const trackId of removedTrackIds) {
      try {
        // Check if already in archive
        const existingArchive = await this.archiveRepository.getArchivedTrack(trackId);
        if (existingArchive) {
          // Already archived, just delete from saved
          await this.repository.deleteSavedTrack(trackId);
          removedCount += 1;
          continue;
        }

        // Get track info from DB before deleting
        const track = dbTracksMap.get(trackId);
        if (track) {
          // Archive the track
          const archivedTrack: ArchivedTrackItem = {
            trackId: track.trackId,
            trackUri: track.trackUri,
            trackName: track.trackName,
            artistName: track.artistName,
            addedAtEpochMs: track.addedAtEpochMs,
            removedAtEpochMs: now,
          };
          await this.archiveRepository.upsertArchivedTrack(archivedTrack);
        }

        // Delete from saved tracks
        await this.repository.deleteSavedTrack(trackId);
        removedCount += 1;
      } catch (error) {
        this.logger.warn(`Failed to archive/delete track ${trackId}: ${(error as Error).message}`);
      }
    }

    return removedCount;
  }
}
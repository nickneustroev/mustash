import { Module } from "@nestjs/common";
import type { ArchiveRepository } from "../persistence/archive-repository.js";
import { BackfillService } from "./backfill-service.js";
import { ConsoleNotifier } from "./console-notifier.js";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import { type HistoryRepository, estimateLivePlayedAt } from "../persistence/history-repository.js";
import {
  APP_CONFIG,
  APP_LOGGER,
  ARCHIVE_REPOSITORY,
  BACKFILL_SERVICE,
  CONSOLE_NOTIFIER,
  HISTORY_REPOSITORY,
  SAVED_TRACK_REPOSITORY,
  SAVED_TRACKS_SYNC_SERVICE,
  SPOTIFY_CLIENT,
  TRACK_WATCHER,
} from "../core/nest.tokens.js";
import { PersistenceModule } from "../persistence/persistence.module.js";
import { SavedTracksSyncService } from "../features/saved-tracks/saved-tracks-sync-service.js";
import type { SavedTrackRepository } from "../persistence/saved-track-repository.js";
import { SpotifyModule } from "../spotify/spotify.module.js";
import type { SpotifyClient } from "../spotify/spotify-client.js";
import { TrackWatcher } from "./track-watcher.js";
import { TrackerOrchestratorService } from "./tracker-orchestrator.service.js";
import type { Logger } from "../shared/types.js";

@Module({
  imports: [CoreModule, SpotifyModule, PersistenceModule],
  providers: [
    {
      provide: CONSOLE_NOTIFIER,
      inject: [APP_LOGGER],
      useFactory: (log: Logger) => new ConsoleNotifier(log),
    },
    {
      provide: TRACK_WATCHER,
      inject: [SPOTIFY_CLIENT, CONSOLE_NOTIFIER, APP_LOGGER, APP_CONFIG, HISTORY_REPOSITORY],
      useFactory: (
        spotifyClient: SpotifyClient,
        notifier: ConsoleNotifier,
        log: Logger,
        cfg: AppConfig,
        historyRepository: HistoryRepository,
      ) =>
        new TrackWatcher(spotifyClient, notifier, log, {
          pollIntervalMs: cfg.pollIntervalMs,
          printOnStart: cfg.printOnStart,
          onNewTrack: async (snapshot) => {
            if (!snapshot.trackUri) {
              return;
            }

            const playedAt = estimateLivePlayedAt({
              fetchedAtEpochMs: snapshot.fetchedAtEpochMs,
              progressMs: snapshot.progressMs,
            });

            const inserted = await historyRepository.addLiveTrack({
              trackUri: snapshot.trackUri,
              playedAt,
              trackName: snapshot.trackName,
              artistName: snapshot.artists[0] ?? null,
            });

            log.info(
              inserted
                ? `Live track saved: ${snapshot.trackUri} at ${playedAt.toISOString()}.`
                : `Live track already exists, refreshed metadata: ${snapshot.trackUri} at ${playedAt.toISOString()}.`,
            );
          },
        }),
    },
    {
      provide: BACKFILL_SERVICE,
      inject: [SPOTIFY_CLIENT, HISTORY_REPOSITORY, APP_LOGGER, APP_CONFIG],
      useFactory: (
        spotifyClient: SpotifyClient,
        historyRepository: HistoryRepository,
        log: Logger,
        cfg: AppConfig,
      ) =>
        new BackfillService(spotifyClient, historyRepository, log, {
          intervalMs: cfg.backfillIntervalMs,
          limit: cfg.backfillLimit,
        }),
    },
    {
      provide: SAVED_TRACKS_SYNC_SERVICE,
      inject: [SPOTIFY_CLIENT, SAVED_TRACK_REPOSITORY, ARCHIVE_REPOSITORY, APP_LOGGER, APP_CONFIG],
      useFactory: (
        spotifyClient: SpotifyClient,
        savedTrackRepository: SavedTrackRepository,
        archiveRepository: ArchiveRepository,
        log: Logger,
        cfg: AppConfig,
      ) =>
        cfg.savedTracksEnabled
          ? new SavedTracksSyncService(spotifyClient, savedTrackRepository, archiveRepository, log, {
              syncIntervalMs: cfg.savedTracksSyncIntervalMs,
            })
          : null,
    },
    TrackerOrchestratorService,
  ],
})
export class TrackerRuntimeModule {}

import { Module } from "@nestjs/common";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import {
  APP_CONFIG,
  APP_LOGGER,
  APP_STATE_REPOSITORY,
  ARCHIVE_REPOSITORY,
  AUTO_PLAYLISTS_FREQUENT_SYNC_SERVICE,
  AUTO_PLAYLISTS_RARE_SYNC_SERVICE,
  AUTO_PLAYLISTS_SYNC_RUNNER,
  CONSOLE_NOTIFIER,
  HISTORY_REPOSITORY,
  SPOTIFY_CLIENT,
  TRACK_WATCHER,
} from "../core/nest.tokens.js";
import { AutoPlaylistsSyncService } from "../features/playlist-definitions/auto-playlists-sync-service.js";
import { SavedTracksSource } from "../features/playlist-definitions/saved-tracks-source.js";
import { createSavedInYearDefinitions } from "../features/saved-in-year/saved-in-year-definition.js";
import { createSavedRecentDefinitions } from "../features/saved-recent/saved-recent-definition.js";
import { PersistenceModule } from "../persistence/persistence.module.js";
import { estimateLivePlayedAt } from "../persistence/history-repository.js";
import type { AppStateRepository, ArchiveRepository, HistoryRepository } from "../persistence/types.js";
import type { Logger } from "../shared/types.js";
import type { SpotifyClient } from "../spotify/spotify-client.js";
import { SpotifyModule } from "../spotify/spotify.module.js";
import { AutoPlaylistsOrchestratorService } from "./auto-playlists-orchestrator.service.js";
import { ConsoleNotifier } from "./console-notifier.js";
import { TrackWatcher } from "./track-watcher.js";

const RARE_SYNC_INITIAL_DELAY_MS = 60_000;

type SyncRunner = <T>(modeName: string, run: () => Promise<T>) => Promise<T>;

@Module({
  imports: [CoreModule, SpotifyModule, PersistenceModule],
  providers: [
    {
      provide: AUTO_PLAYLISTS_SYNC_RUNNER,
      useFactory: (): SyncRunner => {
        let syncQueue = Promise.resolve();

        return async <T>(_modeName: string, run: () => Promise<T>): Promise<T> => {
          const previous = syncQueue;
          let release!: () => void;
          syncQueue = new Promise<void>((resolve) => {
            release = resolve;
          });

          await previous.catch(() => undefined);

          try {
            return await run();
          } finally {
            release();
          }
        };
      },
    },
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
      provide: AUTO_PLAYLISTS_FREQUENT_SYNC_SERVICE,
      inject: [
        SPOTIFY_CLIENT,
        ARCHIVE_REPOSITORY,
        APP_STATE_REPOSITORY,
        APP_LOGGER,
        APP_CONFIG,
        AUTO_PLAYLISTS_SYNC_RUNNER,
      ],
      useFactory: (
        spotifyClient: SpotifyClient,
        archiveRepository: ArchiveRepository,
        appStateRepository: AppStateRepository,
        log: Logger,
        cfg: AppConfig,
        runExclusive: SyncRunner,
      ) => {
        const recentDefinitions = createSavedRecentDefinitions({
          windows: cfg.savedRecentWindows,
          playlistPrefix: cfg.autoPlaylistsPlaylistPrefix,
          playlistSuffix: cfg.autoPlaylistsPlaylistSuffix,
          coverColor: cfg.savedRecentCoverColor,
        });

        if (recentDefinitions.length === 0) {
          return null;
        }

        const maxRecentTracks = Math.max(...cfg.savedRecentWindows);

        return new AutoPlaylistsSyncService(
          spotifyClient,
          new SavedTracksSource(spotifyClient),
          archiveRepository,
          appStateRepository,
          log,
          {
            definitions: recentDefinitions,
            syncIntervalMs: cfg.autoPlaylistsFrequentSyncIntervalMs,
            playlistPrivate: true,
            syncModeName: "frequent",
            runExclusive,
            syncRemovedTracksArchive: false,
            savedTracksRequirements: {
              maxRecentTracks,
            },
          },
        );
      },
    },
    {
      provide: AUTO_PLAYLISTS_RARE_SYNC_SERVICE,
      inject: [
        SPOTIFY_CLIENT,
        ARCHIVE_REPOSITORY,
        APP_STATE_REPOSITORY,
        APP_LOGGER,
        APP_CONFIG,
        AUTO_PLAYLISTS_SYNC_RUNNER,
      ],
      useFactory: (
        spotifyClient: SpotifyClient,
        archiveRepository: ArchiveRepository,
        appStateRepository: AppStateRepository,
        log: Logger,
        cfg: AppConfig,
        runExclusive: SyncRunner,
      ) => {
        const minSavedYear =
          cfg.savedInYearYears.length > 0 ? Math.min(...cfg.savedInYearYears) : undefined;
        const definitions = createSavedInYearDefinitions({
          years: cfg.savedInYearYears,
          playlistPrefix: cfg.autoPlaylistsPlaylistPrefix,
          playlistSuffix: cfg.autoPlaylistsPlaylistSuffix,
          coverColor: cfg.savedInYearCoverColor,
        });

        return definitions.length > 0
          ? new AutoPlaylistsSyncService(
              spotifyClient,
              new SavedTracksSource(spotifyClient),
              archiveRepository,
              appStateRepository,
              log,
              {
                definitions,
                syncIntervalMs: cfg.autoPlaylistsRareSyncIntervalMs,
                initialDelayMs: RARE_SYNC_INITIAL_DELAY_MS,
                playlistPrivate: true,
                syncModeName: "rare",
                runExclusive,
                syncRemovedTracksArchive: true,
                ...(minSavedYear !== undefined
                  ? {
                      savedTracksRequirements: { minSavedYear },
                    }
                  : {}),
              },
            )
          : null;
      },
    },
    AutoPlaylistsOrchestratorService,
  ],
})
export class AutoPlaylistsRuntimeModule {}

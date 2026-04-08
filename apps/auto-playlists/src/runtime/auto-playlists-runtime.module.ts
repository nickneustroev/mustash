import { Module } from "@nestjs/common";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import {
  APP_CONFIG,
  APP_LOGGER,
  APP_STATE_REPOSITORY,
  ARCHIVE_REPOSITORY,
  AUTO_PLAYLISTS_FAST_SYNC_SERVICE,
  AUTO_PLAYLISTS_FULL_SYNC_SERVICE,
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
      provide: AUTO_PLAYLISTS_FAST_SYNC_SERVICE,
      inject: [SPOTIFY_CLIENT, ARCHIVE_REPOSITORY, APP_STATE_REPOSITORY, APP_LOGGER, APP_CONFIG],
      useFactory: (
        spotifyClient: SpotifyClient,
        archiveRepository: ArchiveRepository,
        appStateRepository: AppStateRepository,
        log: Logger,
        cfg: AppConfig,
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
            syncIntervalMs: cfg.autoPlaylistsSyncIntervalMs,
            playlistPrivate: true,
            syncModeName: "fast",
            syncRemovedTracksArchive: false,
            savedTracksRequirements: {
              maxRecentTracks,
            },
          },
        );
      },
    },
    {
      provide: AUTO_PLAYLISTS_FULL_SYNC_SERVICE,
      inject: [SPOTIFY_CLIENT, ARCHIVE_REPOSITORY, APP_STATE_REPOSITORY, APP_LOGGER, APP_CONFIG],
      useFactory: (
        spotifyClient: SpotifyClient,
        archiveRepository: ArchiveRepository,
        appStateRepository: AppStateRepository,
        log: Logger,
        cfg: AppConfig,
      ) => {
        const minSavedYear =
          cfg.savedInYearYears.length > 0 ? Math.min(...cfg.savedInYearYears) : undefined;
        const definitions = [
          ...createSavedRecentDefinitions({
            windows: cfg.savedRecentWindows,
            playlistPrefix: cfg.autoPlaylistsPlaylistPrefix,
            playlistSuffix: cfg.autoPlaylistsPlaylistSuffix,
            coverColor: cfg.savedRecentCoverColor,
          }),
          ...createSavedInYearDefinitions({
            years: cfg.savedInYearYears,
            playlistPrefix: cfg.autoPlaylistsPlaylistPrefix,
            playlistSuffix: cfg.autoPlaylistsPlaylistSuffix,
            coverColor: cfg.savedInYearCoverColor,
          }),
        ];

        return definitions.length > 0
          ? new AutoPlaylistsSyncService(
              spotifyClient,
              new SavedTracksSource(spotifyClient),
              archiveRepository,
              appStateRepository,
              log,
              {
                definitions,
                syncIntervalMs: cfg.autoPlaylistsFullSyncIntervalMs,
                playlistPrivate: true,
                syncModeName: "full",
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

import { Module } from "@nestjs/common";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import { APP_CONFIG, APP_LOGGER, AUTO_PLAYLISTS_SYNC_SERVICE, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import { AutoPlaylistsSyncService } from "../features/playlist-definitions/auto-playlists-sync-service.js";
import { SavedTracksSource } from "../features/playlist-definitions/saved-tracks-source.js";
import { createSavedInYearDefinitions } from "../features/saved-in-year/saved-in-year-definition.js";
import { createSavedRecentDefinitions } from "../features/saved-recent/saved-recent-definition.js";
import type { Logger } from "../shared/types.js";
import type { SpotifyClient } from "../spotify/spotify-client.js";
import { SpotifyModule } from "../spotify/spotify.module.js";
import { AutoPlaylistsOrchestratorService } from "./auto-playlists-orchestrator.service.js";

@Module({
  imports: [CoreModule, SpotifyModule],
  providers: [
    {
      provide: AUTO_PLAYLISTS_SYNC_SERVICE,
      inject: [SPOTIFY_CLIENT, APP_LOGGER, APP_CONFIG],
      useFactory: (spotifyClient: SpotifyClient, log: Logger, cfg: AppConfig) => {
        const maxRecentTracks =
          cfg.savedRecentWindows.length > 0 ? Math.max(...cfg.savedRecentWindows) : undefined;
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
              log,
              {
                definitions,
                syncIntervalMs: cfg.autoPlaylistsSyncIntervalMs,
                playlistPrivate: true,
                savedTracksRequirements: {
                  ...(maxRecentTracks !== undefined ? { maxRecentTracks } : {}),
                  ...(minSavedYear !== undefined ? { minSavedYear } : {}),
                },
              },
            )
          : null;
      },
    },
    AutoPlaylistsOrchestratorService,
  ],
})
export class AutoPlaylistsRuntimeModule {}

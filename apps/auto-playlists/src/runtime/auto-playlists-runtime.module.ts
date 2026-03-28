import { Module } from "@nestjs/common";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import { APP_CONFIG, APP_LOGGER, AUTO_PLAYLISTS_SYNC_SERVICE, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import {
  AutoPlaylistsSyncService,
} from "../features/playlist-definitions/auto-playlists-sync-service.js";
import { SavedTracksSource } from "../features/playlist-definitions/saved-tracks-source.js";
import { createLikedRecentDefinitions } from "../features/liked-recent/liked-recent-definition.js";
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
      useFactory: (spotifyClient: SpotifyClient, log: Logger, cfg: AppConfig) =>
        cfg.likedRecentEnabled
          ? new AutoPlaylistsSyncService(
              spotifyClient,
              new SavedTracksSource(spotifyClient),
              log,
              {
                definitions: createLikedRecentDefinitions({
                  windows: cfg.likedRecentWindows,
                  playlistPrefix: cfg.likedRecentPlaylistPrefix,
                  playlistSuffix: cfg.likedRecentPlaylistSuffix,
                }),
                syncIntervalMs: cfg.likedRecentSyncIntervalMs,
                playlistPrivate: cfg.likedRecentPlaylistPrivate,
              },
            )
          : null,
    },
    AutoPlaylistsOrchestratorService,
  ],
})
export class AutoPlaylistsRuntimeModule {}

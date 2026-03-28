import { Module } from "@nestjs/common";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import { APP_CONFIG, APP_LOGGER, LIKED_RECENT_SYNC_SERVICE, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import { LikedRecentSyncService } from "../features/liked-recent/liked-recent-sync-service.js";
import type { Logger } from "../shared/types.js";
import type { SpotifyClient } from "../spotify/spotify-client.js";
import { SpotifyModule } from "../spotify/spotify.module.js";
import { AutoPlaylistsOrchestratorService } from "./auto-playlists-orchestrator.service.js";

@Module({
  imports: [CoreModule, SpotifyModule],
  providers: [
    {
      provide: LIKED_RECENT_SYNC_SERVICE,
      inject: [SPOTIFY_CLIENT, APP_LOGGER, APP_CONFIG],
      useFactory: (spotifyClient: SpotifyClient, log: Logger, cfg: AppConfig) =>
        cfg.likedRecentEnabled
          ? new LikedRecentSyncService(spotifyClient, log, {
              windows: cfg.likedRecentWindows,
              playlistPrefix: cfg.likedRecentPlaylistPrefix,
              playlistSuffix: cfg.likedRecentPlaylistSuffix,
              syncIntervalMs: cfg.likedRecentSyncIntervalMs,
              playlistPrivate: cfg.likedRecentPlaylistPrivate,
            })
          : null,
    },
    AutoPlaylistsOrchestratorService,
  ],
})
export class AutoPlaylistsRuntimeModule {}

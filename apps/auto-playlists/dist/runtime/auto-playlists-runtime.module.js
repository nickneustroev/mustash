var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { CoreModule } from "../core/core.module.js";
import { APP_CONFIG, APP_LOGGER, LIKED_RECENT_SYNC_SERVICE, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import { LikedRecentSyncService } from "../features/liked-recent/liked-recent-sync-service.js";
import { SpotifyModule } from "../spotify/spotify.module.js";
import { AutoPlaylistsOrchestratorService } from "./auto-playlists-orchestrator.service.js";
let AutoPlaylistsRuntimeModule = class AutoPlaylistsRuntimeModule {
};
AutoPlaylistsRuntimeModule = __decorate([
    Module({
        imports: [CoreModule, SpotifyModule],
        providers: [
            {
                provide: LIKED_RECENT_SYNC_SERVICE,
                inject: [SPOTIFY_CLIENT, APP_LOGGER, APP_CONFIG],
                useFactory: (spotifyClient, log, cfg) => cfg.likedRecentEnabled
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
], AutoPlaylistsRuntimeModule);
export { AutoPlaylistsRuntimeModule };
//# sourceMappingURL=auto-playlists-runtime.module.js.map
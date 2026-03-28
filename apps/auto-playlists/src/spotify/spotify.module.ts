import { Module } from "@nestjs/common";
import type { SpotifyAuthConfig, SpotifyClientConfig } from "@spotify-helper/spotify";
import { AuthManager } from "./auth-manager.js";
import { type AppConfig } from "../core/config.js";
import { CoreModule } from "../core/core.module.js";
import { APP_CONFIG, APP_LOGGER, AUTH_MANAGER, FETCH_IMPL, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import type { Logger } from "../shared/types.js";
import { SpotifyClient } from "./spotify-client.js";

@Module({
  imports: [CoreModule],
  providers: [
    {
      provide: AUTH_MANAGER,
      inject: [APP_CONFIG, APP_LOGGER, FETCH_IMPL],
      useFactory: (cfg: AppConfig, log: Logger, fetchImpl: typeof fetch) =>
        new AuthManager(
          {
            spotifyClientId: cfg.spotifyClientId,
            spotifyClientSecret: cfg.spotifyClientSecret,
            spotifyRedirectUri: cfg.spotifyRedirectUri,
            tokenStoragePath: cfg.tokenStoragePath,
            requestTimeoutMs: cfg.requestTimeoutMs,
            oauthScopes: [
              "user-library-read",
              "ugc-image-upload",
              "playlist-modify-private",
              "playlist-read-private",
            ],
          } satisfies SpotifyAuthConfig,
          log,
          fetchImpl,
        ),
    },
    {
      provide: SPOTIFY_CLIENT,
      inject: [AUTH_MANAGER, APP_CONFIG, APP_LOGGER, FETCH_IMPL],
      useFactory: (
        authManager: AuthManager,
        cfg: AppConfig,
        log: Logger,
        fetchImpl: typeof fetch,
      ) =>
        new SpotifyClient(
          authManager,
          {
            requestTimeoutMs: cfg.requestTimeoutMs,
            spotifyProxyEnabled: cfg.spotifyProxyEnabled,
            spotifyProxyUrl: cfg.spotifyProxyUrl,
          } satisfies SpotifyClientConfig,
          log,
          fetchImpl,
        ),
    },
  ],
  exports: [AUTH_MANAGER, SPOTIFY_CLIENT],
})
export class SpotifyModule {}

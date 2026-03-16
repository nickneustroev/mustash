import { Module } from "@nestjs/common";
import { AuthManager } from "./auth-manager.js";
import { CoreModule } from "../core/core.module.js";
import { AUTH_MANAGER, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import { SpotifyClient } from "./spotify-client.js";

@Module({
  imports: [CoreModule],
  providers: [
    {
      provide: AUTH_MANAGER,
      useClass: AuthManager,
    },
    {
      provide: SPOTIFY_CLIENT,
      useClass: SpotifyClient,
    },
  ],
  exports: [AUTH_MANAGER, SPOTIFY_CLIENT],
})
export class SpotifyModule {}

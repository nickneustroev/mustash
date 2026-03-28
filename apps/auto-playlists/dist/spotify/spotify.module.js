var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Module } from "@nestjs/common";
import { AuthManager } from "./auth-manager.js";
import { CoreModule } from "../core/core.module.js";
import { AUTH_MANAGER, SPOTIFY_CLIENT } from "../core/nest.tokens.js";
import { SpotifyClient } from "./spotify-client.js";
let SpotifyModule = class SpotifyModule {
};
SpotifyModule = __decorate([
    Module({
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
], SpotifyModule);
export { SpotifyModule };
//# sourceMappingURL=spotify.module.js.map
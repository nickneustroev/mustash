var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Inject, Injectable } from "@nestjs/common";
import { getSafeConfigForLogs } from "../core/config.js";
import { APP_CONFIG, APP_LOGGER, AUTH_MANAGER, LIKED_RECENT_SYNC_SERVICE, } from "../core/nest.tokens.js";
let AutoPlaylistsOrchestratorService = class AutoPlaylistsOrchestratorService {
    cfg;
    log;
    authManager;
    likedRecentSyncService;
    shuttingDown = false;
    constructor(cfg, log, authManager, likedRecentSyncService) {
        this.cfg = cfg;
        this.log = log;
        this.authManager = authManager;
        this.likedRecentSyncService = likedRecentSyncService;
    }
    async onModuleInit() {
        this.log.info(`Config loaded: ${JSON.stringify(getSafeConfigForLogs(this.cfg))}`);
        await this.authManager.initialize();
        this.log.info("Spotify auth is ready.");
        this.likedRecentSyncService?.start();
    }
    async onApplicationShutdown(signal) {
        if (this.shuttingDown) {
            return;
        }
        this.shuttingDown = true;
        this.log.info(`Auto playlists stopping (${signal ?? "app.close"}).`);
        this.likedRecentSyncService?.stop();
    }
};
AutoPlaylistsOrchestratorService = __decorate([
    Injectable(),
    __param(0, Inject(APP_CONFIG)),
    __param(1, Inject(APP_LOGGER)),
    __param(2, Inject(AUTH_MANAGER)),
    __param(3, Inject(LIKED_RECENT_SYNC_SERVICE)),
    __metadata("design:paramtypes", [Object, Object, Function, Object])
], AutoPlaylistsOrchestratorService);
export { AutoPlaylistsOrchestratorService };
//# sourceMappingURL=auto-playlists-orchestrator.service.js.map
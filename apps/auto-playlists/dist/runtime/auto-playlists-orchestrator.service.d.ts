import { type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { type AppConfig } from "../core/config.js";
import type { LikedRecentSyncService } from "../features/liked-recent/liked-recent-sync-service.js";
import type { Logger } from "../shared/types.js";
import type { AuthManager } from "../spotify/auth-manager.js";
export declare class AutoPlaylistsOrchestratorService implements OnModuleInit, OnApplicationShutdown {
    private readonly cfg;
    private readonly log;
    private readonly authManager;
    private readonly likedRecentSyncService;
    private shuttingDown;
    constructor(cfg: AppConfig, log: Logger, authManager: AuthManager, likedRecentSyncService: LikedRecentSyncService | null);
    onModuleInit(): Promise<void>;
    onApplicationShutdown(signal?: string): Promise<void>;
}
//# sourceMappingURL=auto-playlists-orchestrator.service.d.ts.map
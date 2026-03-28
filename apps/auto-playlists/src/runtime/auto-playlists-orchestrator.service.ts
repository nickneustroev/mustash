import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { type AppConfig, getSafeConfigForLogs } from "../core/config.js";
import {
  APP_CONFIG,
  APP_LOGGER,
  AUTH_MANAGER,
  LIKED_RECENT_SYNC_SERVICE,
} from "../core/nest.tokens.js";
import type { LikedRecentSyncService } from "../features/liked-recent/liked-recent-sync-service.js";
import type { Logger } from "../shared/types.js";
import type { AuthManager } from "../spotify/auth-manager.js";

@Injectable()
export class AutoPlaylistsOrchestratorService implements OnModuleInit, OnApplicationShutdown {
  private shuttingDown = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(APP_LOGGER) private readonly log: Logger,
    @Inject(AUTH_MANAGER) private readonly authManager: AuthManager,
    @Inject(LIKED_RECENT_SYNC_SERVICE)
    private readonly likedRecentSyncService: LikedRecentSyncService | null,
  ) {}

  public async onModuleInit(): Promise<void> {
    this.log.info(`Config loaded: ${JSON.stringify(getSafeConfigForLogs(this.cfg))}`);
    await this.authManager.initialize();
    this.log.info("Spotify auth is ready.");

    this.likedRecentSyncService?.start();
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;

    this.log.info(`Auto playlists stopping (${signal ?? "app.close"}).`);
    this.likedRecentSyncService?.stop();
  }
}

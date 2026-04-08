import type { PrismaClient } from "@prisma/client";
import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { type AppConfig, getSafeConfigForLogs } from "../core/config.js";
import {
  AUTO_PLAYLISTS_FREQUENT_SYNC_SERVICE,
  AUTO_PLAYLISTS_RARE_SYNC_SERVICE,
  APP_CONFIG,
  APP_LOGGER,
  AUTH_MANAGER,
  PRISMA_CLIENT,
  TRACK_WATCHER,
} from "../core/nest.tokens.js";
import type { AutoPlaylistsSyncService } from "../features/playlist-definitions/auto-playlists-sync-service.js";
import type { Logger } from "../shared/types.js";
import type { AuthManager } from "../spotify/auth-manager.js";
import type { TrackWatcher } from "./track-watcher.js";

@Injectable()
export class AutoPlaylistsOrchestratorService implements OnModuleInit, OnApplicationShutdown {
  private shuttingDown = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(APP_LOGGER) private readonly log: Logger,
    @Inject(AUTH_MANAGER) private readonly authManager: AuthManager,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(TRACK_WATCHER) private readonly watcher: TrackWatcher,
    @Inject(AUTO_PLAYLISTS_FREQUENT_SYNC_SERVICE)
    private readonly autoPlaylistsFrequentSyncService: AutoPlaylistsSyncService | null,
    @Inject(AUTO_PLAYLISTS_RARE_SYNC_SERVICE)
    private readonly autoPlaylistsRareSyncService: AutoPlaylistsSyncService | null,
  ) {}

  public async onModuleInit(): Promise<void> {
    this.log.info(`Config loaded: ${JSON.stringify(getSafeConfigForLogs(this.cfg))}`);
    await this.authManager.initialize();
    this.log.info("Spotify auth is ready.");

    this.watcher.start();
    this.autoPlaylistsFrequentSyncService?.start();
    this.autoPlaylistsRareSyncService?.start();
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;

    this.log.info(`Stopping (${signal ?? "app.close"}).`);
    this.watcher.stop();
    this.autoPlaylistsFrequentSyncService?.stop();
    this.autoPlaylistsRareSyncService?.stop();
    await this.prisma.$disconnect();
  }
}

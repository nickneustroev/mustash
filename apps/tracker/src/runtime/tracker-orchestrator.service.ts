import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { AuthManager } from "../spotify/auth-manager.js";
import { BackfillService } from "./backfill-service.js";
import { type AppConfig, getSafeConfigForLogs } from "../core/config.js";
import type { HistoryRepository } from "../persistence/history-repository.js";
import { LikedRecentSyncService } from "../features/liked-recent/liked-recent-sync-service.js";
import {
  APP_CONFIG,
  APP_LOGGER,
  AUTH_MANAGER,
  BACKFILL_SERVICE,
  HISTORY_REPOSITORY,
  LIKED_RECENT_SYNC_SERVICE,
  SAVED_TRACKS_SYNC_SERVICE,
  TRACK_WATCHER,
} from "../core/nest.tokens.js";
import { SavedTracksSyncService } from "../features/saved-tracks/saved-tracks-sync-service.js";
import { TrackWatcher } from "./track-watcher.js";
import type { Logger } from "../shared/types.js";

@Injectable()
export class TrackerOrchestratorService implements OnModuleInit, OnApplicationShutdown {
  private shuttingDown = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(APP_LOGGER) private readonly log: Logger,
    @Inject(AUTH_MANAGER) private readonly authManager: AuthManager,
    @Inject(HISTORY_REPOSITORY) private readonly historyRepository: HistoryRepository,
    @Inject(TRACK_WATCHER) private readonly watcher: TrackWatcher,
    @Inject(BACKFILL_SERVICE) private readonly backfillService: BackfillService,
    @Inject(LIKED_RECENT_SYNC_SERVICE)
    private readonly likedRecentSyncService: LikedRecentSyncService | null,
    @Inject(SAVED_TRACKS_SYNC_SERVICE)
    private readonly savedTracksSyncService: SavedTracksSyncService | null,
  ) {}

  public async onModuleInit(): Promise<void> {
    this.log.info(`Config loaded: ${JSON.stringify(getSafeConfigForLogs(this.cfg))}`);
    await this.authManager.initialize();
    this.log.info("Spotify auth is ready.");

    this.watcher.start();
    this.backfillService.start();
    this.likedRecentSyncService?.start();
    this.savedTracksSyncService?.start();
  }

  public async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.shuttingDown) {
      return;
    }
    this.shuttingDown = true;

    this.log.info(`Tracker stopping (${signal ?? "app.close"}).`);
    this.watcher.stop();
    this.likedRecentSyncService?.stop();
    this.savedTracksSyncService?.stop();
    this.backfillService.stop();
    await this.historyRepository.close();
  }
}

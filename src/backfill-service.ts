import { SpotifyRateLimitError } from "./errors.js";
import type { Logger } from "./types.js";
import type { SpotifyClient } from "./spotify-client.js";
import type { HistoryStore } from "./history-store.js";
import type { PlaylistSyncScheduler } from "./playlist-sync-scheduler.js";

interface BackfillOptions {
  intervalMs: number;
  limit: number;
}

export class BackfillService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = true;

  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly historyStore: HistoryStore,
    private readonly syncScheduler: PlaylistSyncScheduler,
    private readonly logger: Logger,
    private readonly options: BackfillOptions,
  ) {}

  public start(): void {
    this.stopped = false;
    void this.runBackfill();
    this.timer = setInterval(() => {
      void this.runBackfill();
    }, this.options.intervalMs);
    this.logger.info(
      `Backfill started (interval=${this.options.intervalMs}ms, limit=${this.options.limit}).`,
    );
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Backfill stopped.");
  }

  private async runBackfill(): Promise<void> {
    if (this.running || this.stopped) {
      return;
    }
    this.running = true;

    try {
      const recentlyPlayed = await this.spotifyClient.getRecentlyPlayed(this.options.limit);
      const changed = this.historyStore.addBackfillItems(recentlyPlayed);
      if (!changed) {
        return;
      }
      await this.historyStore.save();
      this.syncScheduler.markDirty();
      this.logger.info(`Backfill added ${recentlyPlayed.length} candidate items.`);
    } catch (error) {
      if (error instanceof SpotifyRateLimitError) {
        this.logger.warn(
          `Backfill rate-limited, retry after ${error.retryAfterSeconds}s on next interval.`,
        );
      } else {
        this.logger.warn(`Backfill failed: ${(error as Error).message}`);
      }
    } finally {
      this.running = false;
    }
  }
}

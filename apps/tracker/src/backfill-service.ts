import { SpotifyRateLimitError } from "./errors.js";
import type { Logger } from "./types.js";
import type { SpotifyClient } from "./spotify-client.js";
import type { HistoryRepository } from "./history-repository.js";

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
    private readonly historyRepository: HistoryRepository,
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
      const inserted = await this.historyRepository.addBackfillItems(recentlyPlayed);
      if (inserted === 0) {
        return;
      }
      this.logger.info(`Backfill inserted ${inserted} new items from ${recentlyPlayed.length} candidates.`);
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

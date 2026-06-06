import { SpotifyRateLimitError } from "../shared/errors.js";
import { decideTrackEvent, type TrackDecisionState } from "./track-decision.js";
import type { Logger, PlaybackSnapshot } from "../shared/types.js";
import type { SpotifyClient } from "../spotify/spotify-client.js";
import { t } from "../i18n/index.js";
import type { ConsoleNotifier } from "./console-notifier.js";

interface TrackWatcherOptions {
  pollIntervalMs: number;
  printOnStart: boolean;
  onNewTrack?: (snapshot: PlaybackSnapshot) => Promise<void>;
}

export class TrackWatcher {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private state: TrackDecisionState = {
    initialized: false,
    lastReportedTrackId: null,
  };

  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly notifier: ConsoleNotifier,
    private readonly logger: Logger,
    private readonly opts: TrackWatcherOptions,
    private readonly randomFn: () => number = Math.random,
  ) {}

  public start(): void {
    this.stopped = false;
    this.logger.info(t("trackWatcherStarted", this.opts.pollIntervalMs));
    this.scheduleNextTick(0);
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.logger.info(t("trackWatcherStopped"));
  }

  private scheduleNextTick(delayMs: number): void {
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    let delayMs = this.opts.pollIntervalMs;

    try {
      const snapshot = await this.spotifyClient.getCurrentlyPlaying();
      const decision = decideTrackEvent(this.state, snapshot, this.opts.printOnStart);
      this.state = decision.nextState;

      if (decision.shouldEmit && snapshot) {
        this.notifier.notifyNewTrack(snapshot);
        if (this.opts.onNewTrack) {
          await this.opts.onNewTrack(snapshot);
        }
      }
    } catch (error) {
      if (error instanceof SpotifyRateLimitError) {
        delayMs = calculateBackoffDelayMs(
          this.opts.pollIntervalMs,
          error.retryAfterSeconds,
          this.randomFn,
        );
        this.logger.warn(t("spotifyRateLimitedBackingOff", delayMs));
      } else {
        this.logger.warn(t("pollingFailed", (error as Error).message, delayMs));
      }
    } finally {
      this.scheduleNextTick(delayMs);
    }
  }
}

export function calculateBackoffDelayMs(
  pollIntervalMs: number,
  retryAfterSeconds: number,
  randomFn: () => number,
): number {
  const retryDelay = Math.max(0, retryAfterSeconds) * 1000;
  const jitter = Math.floor(randomFn() * 300) + 100;
  return Math.max(pollIntervalMs, retryDelay + jitter);
}

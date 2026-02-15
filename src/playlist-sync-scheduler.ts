import type { Logger } from "./types.js";

export class PlaylistSyncScheduler {
  private timer: NodeJS.Timeout | null = null;
  private dirty = false;
  private syncing = false;
  private scheduledAfterSync = false;

  constructor(
    private readonly debounceMs: number,
    private readonly getTrackUris: () => string[],
    private readonly syncFn: (trackUris: string[]) => Promise<void>,
    private readonly logger: Logger,
  ) {}

  public markDirty(): void {
    this.dirty = true;
    this.schedule();
  }

  public async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runSync();
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.runSync();
  }

  private schedule(): void {
    if (this.timer || this.syncing) {
      if (this.syncing) {
        this.scheduledAfterSync = true;
      }
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      void this.runSync();
    }, this.debounceMs);
  }

  private async runSync(): Promise<void> {
    if (this.syncing) {
      this.scheduledAfterSync = true;
      return;
    }

    if (!this.dirty) {
      return;
    }

    this.syncing = true;
    this.dirty = false;

    try {
      const trackUris = this.getTrackUris();
      await this.syncFn(trackUris);
      this.logger.info(`Playlist sync completed (${trackUris.length} items).`);
    } catch (error) {
      this.dirty = true;
      this.logger.warn(`Playlist sync failed: ${(error as Error).message}`);
    } finally {
      this.syncing = false;
      if (this.scheduledAfterSync || this.dirty) {
        this.scheduledAfterSync = false;
        this.schedule();
      }
    }
  }
}

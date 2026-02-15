import { SpotifyRateLimitError } from "./errors.js";
import type { Logger } from "./types.js";
import type { SpotifyClient } from "./spotify-client.js";

interface LikedRecentSyncOptions {
  windows: number[];
  playlistPrefix: string;
  playlistSuffix: string;
  syncIntervalMs: number;
  playlistPrivate: boolean;
}

export class LikedRecentSyncService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = true;
  private readonly playlistIdsByWindow = new Map<number, string>();
  private readonly lastHashesByWindow = new Map<number, string>();

  constructor(
    private readonly spotifyClient: SpotifyClient,
    private readonly logger: Logger,
    private readonly options: LikedRecentSyncOptions,
  ) {}

  public start(): void {
    if (this.options.windows.length === 0) {
      this.logger.warn("Liked recent sync is enabled but windows list is empty. Service disabled.");
      return;
    }
    this.stopped = false;
    void this.syncNow();
    this.timer = setInterval(() => {
      void this.syncNow();
    }, this.options.syncIntervalMs);
    this.logger.info(
      `Liked recent sync started (windows=${this.options.windows.join(",")}, interval=${this.options.syncIntervalMs}ms).`,
    );
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info("Liked recent sync stopped.");
  }

  public async syncNow(): Promise<void> {
    if (this.stopped || this.running) {
      return;
    }

    this.running = true;
    try {
      await this.ensurePlaylists();
      const maxWindow = this.options.windows[this.options.windows.length - 1] ?? 0;
      const likedUris = await this.spotifyClient.getRecentLikedUris(maxWindow);

      for (const windowSize of this.options.windows) {
        const playlistId = this.playlistIdsByWindow.get(windowSize);
        if (!playlistId) {
          continue;
        }

        const windowUris = likedUris.slice(0, windowSize);
        const hash = hashUris(windowUris);
        if (this.lastHashesByWindow.get(windowSize) === hash) {
          continue;
        }

        await this.spotifyClient.replacePlaylistItems(playlistId, windowUris);
        this.lastHashesByWindow.set(windowSize, hash);
        this.logger.info(
          `Liked recent playlist synced (${buildLikedRecentPlaylistName(this.options.playlistPrefix, this.options.playlistSuffix, windowSize)}, ${windowUris.length} items).`,
        );
      }
    } catch (error) {
      if (error instanceof SpotifyRateLimitError) {
        this.logger.warn(
          `Liked recent sync rate-limited. Retry after ${error.retryAfterSeconds}s on next interval.`,
        );
      } else {
        this.logger.warn(`Liked recent sync failed: ${(error as Error).message}`);
      }
    } finally {
      this.running = false;
    }
  }

  private async ensurePlaylists(): Promise<void> {
    const userId = await this.spotifyClient.getCurrentUserId();

    for (const windowSize of this.options.windows) {
      if (this.playlistIdsByWindow.has(windowSize)) {
        continue;
      }

      const playlistName = buildLikedRecentPlaylistName(
        this.options.playlistPrefix,
        this.options.playlistSuffix,
        windowSize,
      );
      const existing = await this.spotifyClient.findPlaylistByName(playlistName);
      if (existing) {
        this.playlistIdsByWindow.set(windowSize, existing.id);
        continue;
      }

      const created = await this.spotifyClient.createPlaylist(
        userId,
        playlistName,
        `Auto-maintained recent liked tracks (${windowSize}).`,
        this.options.playlistPrivate,
      );
      this.playlistIdsByWindow.set(windowSize, created.id);
      this.logger.info(`Liked recent playlist created (${playlistName}).`);
    }
  }
}

export function buildLikedRecentPlaylistName(prefix: string, suffix: string, windowSize: number): string {
  return `${prefix} ${windowSize} ${suffix}`.replace(/\s+/g, " ").trim();
}

export function hashUris(uris: string[]): string {
  return `${uris.length}:${uris.join("|")}`;
}

import { describe, expect, it, vi } from "vitest";
import { BackfillService } from "../src/backfill-service.js";
import type { Logger } from "../src/types.js";
import type { SpotifyClient } from "../src/spotify-client.js";
import type { HistoryStore } from "../src/history-store.js";
import type { PlaylistSyncScheduler } from "../src/playlist-sync-scheduler.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("BackfillService", () => {
  it("persists and marks dirty when backfill changes history", async () => {
    const getRecentlyPlayed = vi
      .fn()
      .mockResolvedValue([{ trackUri: "spotify:track:a", playedAtEpochMs: 1 }]);
    const addBackfillItems = vi.fn().mockReturnValue(true);
    const save = vi.fn().mockResolvedValue(undefined);
    const markDirty = vi.fn();

    const spotifyClient = {
      getRecentlyPlayed,
    } as unknown as SpotifyClient;
    const historyStore = {
      addBackfillItems,
      save,
    } as unknown as HistoryStore;
    const scheduler = {
      markDirty,
    } as unknown as PlaylistSyncScheduler;

    const service = new BackfillService(spotifyClient, historyStore, scheduler, log, {
      intervalMs: 60000,
      limit: 50,
    });

    service.start();
    await vi.waitFor(() => {
      expect(markDirty).toHaveBeenCalledTimes(1);
    });
    service.stop();

    expect(getRecentlyPlayed).toHaveBeenCalledWith(50);
    expect(addBackfillItems).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(markDirty).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { PlaylistSyncScheduler } from "../src/playlist-sync-scheduler.js";
import type { Logger } from "../src/types.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("PlaylistSyncScheduler", () => {
  it("debounces sync calls", async () => {
    vi.useFakeTimers();
    const syncFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new PlaylistSyncScheduler(1000, () => ["spotify:track:a"], syncFn, log);

    scheduler.markDirty();
    scheduler.markDirty();
    scheduler.markDirty();

    await vi.advanceTimersByTimeAsync(999);
    expect(syncFn).toHaveBeenCalledTimes(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(syncFn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("flushes pending changes on stop", async () => {
    const syncFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new PlaylistSyncScheduler(5000, () => ["spotify:track:x"], syncFn, log);

    scheduler.markDirty();
    await scheduler.stop();

    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(syncFn).toHaveBeenCalledWith(["spotify:track:x"]);
  });
});

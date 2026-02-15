import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { HistoryStore } from "../src/history-store.js";
import type { Logger } from "../src/types.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("HistoryStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps rolling max size and allows duplicates", async () => {
    const tmpPath = path.join(os.tmpdir(), `history-store-${Date.now()}.json`);
    const store = new HistoryStore(tmpPath, 3, log);
    await store.load();

    vi.spyOn(Date, "now")
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce(40);

    store.addLiveTrack("spotify:track:a");
    store.addLiveTrack("spotify:track:a");
    store.addLiveTrack("spotify:track:b");
    store.addLiveTrack("spotify:track:c");

    expect(store.getTrackUris()).toEqual([
      "spotify:track:c",
      "spotify:track:b",
      "spotify:track:a",
    ]);

    await store.save();
    await fs.unlink(tmpPath);
  });

  it("backfill skips exact duplicate playback events", async () => {
    const tmpPath = path.join(os.tmpdir(), `history-store-${Date.now()}-2.json`);
    const store = new HistoryStore(tmpPath, 10, log);
    await store.load();

    store.addBackfillItems([
      { trackUri: "spotify:track:a", playedAtEpochMs: 1000 },
      { trackUri: "spotify:track:b", playedAtEpochMs: 2000 },
    ]);
    const changed = store.addBackfillItems([
      { trackUri: "spotify:track:b", playedAtEpochMs: 2000 },
      { trackUri: "spotify:track:c", playedAtEpochMs: 3000 },
    ]);

    expect(changed).toBe(true);
    expect(store.getTrackUris()).toEqual([
      "spotify:track:c",
      "spotify:track:b",
      "spotify:track:a",
    ]);
  });
});

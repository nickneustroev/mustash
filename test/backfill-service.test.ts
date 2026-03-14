import { describe, expect, it, vi } from "vitest";
import { BackfillService } from "../src/backfill-service.js";
import type { Logger } from "../src/types.js";
import type { SpotifyClient } from "../src/spotify-client.js";
import type { HistoryRepository } from "../src/history-repository.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("BackfillService", () => {
  it("writes backfill items into repository when history changed", async () => {
    const getRecentlyPlayed = vi
      .fn()
      .mockResolvedValue([{ trackUri: "spotify:track:a", playedAtEpochMs: 1 }]);
    const addBackfillItems = vi.fn().mockResolvedValue(1);

    const spotifyClient = {
      getRecentlyPlayed,
    } as unknown as SpotifyClient;
    const historyRepository = {
      addBackfillItems,
    } as unknown as HistoryRepository;

    const service = new BackfillService(spotifyClient, historyRepository, log, {
      intervalMs: 60000,
      limit: 50,
    });

    service.start();
    await vi.waitFor(() => {
      expect(addBackfillItems).toHaveBeenCalledTimes(1);
    });
    service.stop();

    expect(getRecentlyPlayed).toHaveBeenCalledWith(50);
    expect(addBackfillItems).toHaveBeenCalledTimes(1);
  });
});

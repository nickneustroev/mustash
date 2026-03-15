import { describe, expect, it, vi } from "vitest";
import {
  estimateLivePlayedAtEpochMs,
  PrismaHistoryRepository,
} from "../src/history-repository.js";
import type { Logger } from "../src/types.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("PrismaHistoryRepository", () => {
  it("uses estimated playback start for live events", () => {
    expect(
      estimateLivePlayedAtEpochMs({
        fetchedAtEpochMs: 1_000,
        progressMs: 250,
      }),
    ).toBe(750);
  });

  it("falls back to fetch time when progress is missing", () => {
    expect(
      estimateLivePlayedAtEpochMs({
        fetchedAtEpochMs: 1_000,
        progressMs: null,
      }),
    ).toBe(1_000);
  });

  it("treats duplicate live inserts as idempotent", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      playedTrack: {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        updateMany,
      },
    };
    const repository = new PrismaHistoryRepository(prisma as never, log);

    await expect(
      repository.addLiveTrack({
        trackUri: "spotify:track:test",
        playedAtEpochMs: 1_000,
      }),
    ).resolves.toBe(false);

    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});

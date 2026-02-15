import { describe, expect, it, vi } from "vitest";
import {
  buildLikedRecentPlaylistName,
  hashUris,
  LikedRecentSyncService,
} from "../src/liked-recent-sync-service.js";
import type { Logger } from "../src/types.js";
import type { SpotifyClient } from "../src/spotify-client.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("LikedRecentSyncService", () => {
  it("builds playlist names", () => {
    expect(buildLikedRecentPlaylistName("LIKED RECENT", "[AUTO]", 20)).toBe(
      "LIKED RECENT 20 [AUTO]",
    );
  });

  it("skips replace calls when window content did not change", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("user-1");
    const findPlaylistByName = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const createPlaylist = vi
      .fn()
      .mockResolvedValueOnce({ id: "p20", name: "LIKED RECENT 20 [AUTO]" })
      .mockResolvedValueOnce({ id: "p50", name: "LIKED RECENT 50 [AUTO]" });
    const getRecentLikedUris = vi
      .fn()
      .mockResolvedValueOnce(["spotify:track:a", "spotify:track:b", "spotify:track:c"])
      .mockResolvedValueOnce(["spotify:track:a", "spotify:track:b", "spotify:track:c"]);
    const replacePlaylistItems = vi.fn().mockResolvedValue(undefined);

    const spotifyClient = {
      getCurrentUserId,
      findPlaylistByName,
      createPlaylist,
      getRecentLikedUris,
      replacePlaylistItems,
    } as unknown as SpotifyClient;

    const service = new LikedRecentSyncService(spotifyClient, log, {
      windows: [2, 3],
      playlistPrefix: "LIKED RECENT",
      playlistSuffix: "[AUTO]",
      syncIntervalMs: 15000,
      playlistPrivate: true,
    });

    service.start();
    await vi.waitFor(() => {
      expect(replacePlaylistItems).toHaveBeenCalledTimes(2);
    });
    await service.syncNow();
    service.stop();

    expect(replacePlaylistItems).toHaveBeenCalledTimes(2);
  });

  it("hashes uri arrays deterministically", () => {
    expect(hashUris(["a", "b"])).toBe(hashUris(["a", "b"]));
    expect(hashUris(["a", "b"])).not.toBe(hashUris(["b", "a"]));
  });
});

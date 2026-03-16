import { describe, expect, it, vi } from "vitest";
import { SpotifyClient } from "../src/spotify-client.js";
import type { AuthManager } from "../src/auth-manager.js";
import type { AppConfig } from "../src/config.js";
import type { Logger } from "../src/types.js";

function createConfig(): AppConfig {
  return {
    spotifyClientId: "id",
    spotifyClientSecret: "secret",
    spotifyRedirectUri: "http://127.0.0.1:3000/callback",
    pollIntervalMs: 2500,
    printOnStart: false,
    tokenStoragePath: ".spotify-tokens.json",
    requestTimeoutMs: 5000,
    databaseUrl: "file:./test.db",
    backfillIntervalMs: 60000,
    backfillLimit: 50,
    likedRecentEnabled: false,
    likedRecentWindows: [20, 50, 100],
    likedRecentPlaylistPrefix: "LIKED RECENT",
    likedRecentPlaylistSuffix: "[AUTO]",
    likedRecentSyncIntervalMs: 15000,
    likedRecentPlaylistPrivate: true,
    spotifyProxyEnabled: false,
    spotifyProxyUrl: "",
  };
}

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("SpotifyClient unauthorized retry", () => {
  it("refreshes token and retries once on 401", async () => {
    const auth = {
      getAccessToken: vi
        .fn()
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("fresh-token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            is_playing: true,
            currently_playing_type: "track",
            item: {
              id: "track-2",
              name: "Song",
              artists: [{ name: "Artist" }],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const client = new SpotifyClient(auth, createConfig(), log, fetchMock);
    const result = await client.getCurrentlyPlaying();

    expect(auth.handleUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.trackId).toBe("track-2");
  });
});

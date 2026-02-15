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
    printOnStart: true,
    tokenStoragePath: ".spotify-tokens.json",
    requestTimeoutMs: 5000,
    historyPlaylistName: "HISTORY [AUTO]",
    historyMaxItems: 100,
    historyStatePath: ".history-state.json",
    playlistSyncDebounceMs: 7000,
    backfillIntervalMs: 60000,
    backfillLimit: 50,
  };
}

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("SpotifyClient recently played", () => {
  it("returns only valid recently-played items", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              played_at: "2026-02-15T13:00:00.000Z",
              track: { id: "a", uri: "spotify:track:a" },
            },
            {
              played_at: "not-date",
              track: { id: "b", uri: "spotify:track:b" },
            },
            {
              played_at: "2026-02-15T13:01:00.000Z",
              track: null,
            },
            {
              played_at: "2026-02-15T13:02:00.000Z",
              track: { id: "c" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new SpotifyClient(auth, createConfig(), log, fetchMock);
    const items = await client.getRecentlyPlayed(50);

    expect(items).toHaveLength(2);
    expect(items[0]?.trackUri).toBe("spotify:track:a");
    expect(items[1]?.trackUri).toBe("spotify:track:c");
  });
});

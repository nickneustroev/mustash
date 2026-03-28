import { describe, expect, it, vi } from "vitest";
import { SpotifyClient } from "../src/spotify/spotify-client.js";
import type { AuthManager } from "../src/spotify/auth-manager.js";
import type { AppConfig } from "../src/core/config.js";
import type { Logger } from "../src/shared/types.js";

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
    spotifyProxyEnabled: false,
    spotifyProxyUrl: "",
  };
}

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("SpotifyClient rate limit handling", () => {
  it("waits retry-after and retries request", async () => {
    vi.useFakeTimers();
    try {
      const auth = {
        getAccessToken: vi.fn().mockResolvedValue("token"),
        handleUnauthorized: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthManager;

      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response("{}", { status: 429, headers: { "retry-after": "1" } }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "user-1" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const client = new SpotifyClient(auth, createConfig(), log, fetchMock);
      const resultPromise = client.getCurrentUserId();

      await vi.advanceTimersByTimeAsync(1000);
      const userId = await resultPromise;

      expect(userId).toBe("user-1");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

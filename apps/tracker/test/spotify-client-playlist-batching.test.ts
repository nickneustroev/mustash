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
    printOnStart: true,
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

describe("SpotifyClient playlist batching", () => {
  it("splits playlist replace into PUT(100) + POST batches for >100 uris", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } }));

    const client = new SpotifyClient(auth, createConfig(), log, fetchMock);
    const uris = Array.from({ length: 200 }, (_, idx) => `spotify:track:${idx}`);

    await client.replacePlaylistItems("playlist-1", uris);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstCall = fetchMock.mock.calls[0];
    const secondCall = fetchMock.mock.calls[1];
    expect(firstCall?.[1]?.method).toBe("PUT");
    expect(secondCall?.[1]?.method).toBe("POST");

    const firstBody = JSON.parse(String(firstCall?.[1]?.body)) as { uris: string[] };
    const secondBody = JSON.parse(String(secondCall?.[1]?.body)) as { uris: string[] };
    expect(firstBody.uris).toHaveLength(100);
    expect(secondBody.uris).toHaveLength(100);
  });
});

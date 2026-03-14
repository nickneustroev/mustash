import { describe, expect, it, vi } from "vitest";
import { SpotifyClient } from "../src/spotify-client.js";
import type { AuthManager } from "../src/auth-manager.js";
import type { AppConfig } from "../src/config.js";
import type { Logger } from "../src/types.js";

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
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
    likedRecentEnabled: true,
    likedRecentWindows: [20, 50, 100],
    likedRecentPlaylistPrefix: "LIKED RECENT",
    likedRecentPlaylistSuffix: "[AUTO]",
    likedRecentSyncIntervalMs: 15000,
    likedRecentPlaylistPrivate: true,
    spotifyProxyEnabled: true,
    spotifyProxyUrl: "http://user:pass@127.0.0.1:8888",
    spotifyProxyOnGeoBlockOnly: true,
    ...overrides,
  };
}

function createLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe("SpotifyClient proxy fallback", () => {
  it("retries through proxy on geo-block 403", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;
    const log = createLogger();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              status: 403,
              message: "Spotify is unavailable in this country",
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }));

    const client = new SpotifyClient(auth, createConfig(), log, fetchMock);
    const userId = await client.getCurrentUserId();

    expect(userId).toBe("user-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[0][1] as { dispatcher?: unknown }).dispatcher).toBeUndefined();
    expect((fetchMock.mock.calls[1][1] as { dispatcher?: unknown }).dispatcher).toBeDefined();
    expect(log.warn).toHaveBeenCalledWith(
      "Spotify API geo-block detected (403). Retrying request via configured proxy.",
    );
  });

  it("warns and fails when geo-block happens without configured proxy URL", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;
    const log = createLogger();

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            status: 403,
            message: "Spotify is unavailable in this country",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new SpotifyClient(
      auth,
      createConfig({
        spotifyProxyEnabled: true,
        spotifyProxyUrl: "",
      }),
      log,
      fetchMock,
    );

    await expect(client.getCurrentUserId()).rejects.toThrow("Spotify request failed (403)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      "Spotify geo-block detected but proxy is not configured. Set SPOTIFY_PROXY_ENABLED=true and SPOTIFY_PROXY_URL=http://user:pass@host:port.",
    );
  });

  it("does not switch to proxy for unrelated 403 responses", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;
    const log = createLogger();

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            status: 403,
            message: "Forbidden",
          },
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    const client = new SpotifyClient(auth, createConfig(), log, fetchMock);
    await expect(client.getCurrentUserId()).rejects.toThrow("Spotify request failed (403)");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as { dispatcher?: unknown }).dispatcher).toBeUndefined();
  });

  it("keeps using proxy for next requests after first geo-block fallback", async () => {
    const auth = {
      getAccessToken: vi.fn().mockResolvedValue("token"),
      handleUnauthorized: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthManager;
    const log = createLogger();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              status: 403,
              message: "Spotify is unavailable in this country",
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1" }), { status: 200 }));

    const client = new SpotifyClient(auth, createConfig(), log, fetchMock);

    await client.getCurrentUserId();
    await client.getCurrentUserId();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1][1] as { dispatcher?: unknown }).dispatcher).toBeDefined();
    expect((fetchMock.mock.calls[2][1] as { dispatcher?: unknown }).dispatcher).toBeDefined();
  });
});

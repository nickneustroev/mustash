import { describe, expect, it, vi } from "vitest";
import type { Logger, SpotifyClientConfig } from "../src/shared/types.js";
import { SpotifyClient } from "../src/spotify/spotify-client.js";
import { SpotifyRateLimitError } from "../src/spotify/errors.js";
import type { AuthManager } from "../src/spotify/auth-manager.js";

const log: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const cfg: SpotifyClientConfig = {
  requestTimeoutMs: 5000,
  minRequestGapMs: 25,
  spotifyProxyEnabled: false,
  spotifyProxyUrl: "",
};

function createClient(fetchImpl: typeof fetch): SpotifyClient {
  const auth = {
    getAccessToken: vi.fn().mockResolvedValue("token"),
    handleUnauthorized: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthManager;

  return new SpotifyClient(auth, cfg, log, fetchImpl);
}

describe("SpotifyClient rate limiting", () => {
  it("retries after 429 and honors retry-after before succeeding", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("{}", {
          status: 429,
          headers: {
            "retry-after": "1",
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "user-1" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
      );

    const client = createClient(fetchImpl);
    const request = client.getCurrentUserId();

    await vi.advanceTimersByTimeAsync(1249);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(100);
    await expect(request).resolves.toBe("user-1");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("serializes concurrent requests and spaces them out", async () => {
    vi.useFakeTimers();
    const startedAt: number[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => {
      startedAt.push(Date.now());
      return new Response(JSON.stringify({ id: `user-${startedAt.length}` }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    });

    const client = createClient(fetchImpl);
    const requests = [client.getCurrentUserId(), client.getCurrentUserId(), client.getCurrentUserId()];

    await vi.runAllTimersAsync();
    await expect(Promise.all(requests)).resolves.toEqual(["user-1", "user-2", "user-3"]);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(cfg.minRequestGapMs);
    expect(startedAt[2] - startedAt[1]).toBeGreaterThanOrEqual(cfg.minRequestGapMs);
  });

  it("throws SpotifyRateLimitError after retry budget is exhausted", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("{}", {
        status: 429,
        headers: {
          "retry-after": "1",
        },
      }),
    );

    const client = createClient(fetchImpl);
    const request = expect(client.getCurrentUserId()).rejects.toBeInstanceOf(SpotifyRateLimitError);

    await vi.runAllTimersAsync();
    await request;
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

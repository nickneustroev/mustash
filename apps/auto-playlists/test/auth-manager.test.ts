import { beforeEach, describe, expect, it, vi } from "vitest";
import { initLocale } from "../src/i18n/index.js";
import type { Logger, OAuthTokenStore, OAuthTokens, SpotifyAuthConfig } from "../src/shared/types.js";
import { AuthManager } from "../src/spotify/auth-manager.js";

const cfg: SpotifyAuthConfig = {
  spotifyClientId: "client-id",
  spotifyClientSecret: "client-secret",
  spotifyRedirectUri: "http://127.0.0.1:3000/callback",
  requestTimeoutMs: 5000,
  oauthScopes: ["user-library-read"],
};

const logger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe("AuthManager", () => {
  beforeEach(() => {
    initLocale("EN");
    vi.clearAllMocks();
  });

  it("refreshes stored tokens during initialization even when access token is not near expiration", async () => {
    const tokenStore: OAuthTokenStore = {
      loadTokens: vi.fn().mockResolvedValue({
        accessToken: "stored-access",
        refreshToken: "stored-refresh",
        expiresAtEpochMs: Date.now() + 60 * 60 * 1000,
      } satisfies OAuthTokens),
      saveTokens: vi.fn().mockResolvedValue(undefined),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: "refreshed-access",
        refresh_token: "refreshed-refresh",
        expires_in: 3600,
      }),
    });

    const manager = new AuthManager(cfg, tokenStore, logger, fetchImpl as unknown as typeof fetch);

    await manager.initialize();

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://accounts.spotify.com/api/token",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(tokenStore.saveTokens).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "refreshed-access",
        refreshToken: "refreshed-refresh",
      }),
    );
  });

  it("fails initialization immediately when stored tokens cannot be refreshed", async () => {
    const tokenStore: OAuthTokenStore = {
      loadTokens: vi.fn().mockResolvedValue({
        accessToken: "stored-access",
        refreshToken: "stored-refresh",
        expiresAtEpochMs: Date.now() + 60 * 60 * 1000,
      } satisfies OAuthTokens),
      saveTokens: vi.fn().mockResolvedValue(undefined),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('{"error":"invalid_client"}'),
    });

    const manager = new AuthManager(cfg, tokenStore, logger, fetchImpl as unknown as typeof fetch);

    await expect(manager.initialize()).rejects.toThrow(
      'Token refresh failed (400): {"error":"invalid_client"}',
    );
    expect(tokenStore.saveTokens).not.toHaveBeenCalled();
  });

  it("uses russian locale for token refresh errors", async () => {
    initLocale("RU");

    const tokenStore: OAuthTokenStore = {
      loadTokens: vi.fn().mockResolvedValue({
        accessToken: "stored-access",
        refreshToken: "stored-refresh",
        expiresAtEpochMs: Date.now() + 60 * 60 * 1000,
      } satisfies OAuthTokens),
      saveTokens: vi.fn().mockResolvedValue(undefined),
    };

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('{"error":"invalid_client","error_description":"Invalid client"}'),
    });

    const manager = new AuthManager(cfg, tokenStore, logger, fetchImpl as unknown as typeof fetch);

    await expect(manager.initialize()).rejects.toThrow(
      'Не удалось обновить токен Spotify (400): {"error":"invalid_client","error_description":"Invalid client"}',
    );
  });
});

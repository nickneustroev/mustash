import type { AppStateRepository } from "@spotify-helper/db";
import { describe, expect, it, vi } from "vitest";
import type { Logger, OAuthTokens } from "@spotify-helper/spotify";
import { AppStateOAuthTokenStore } from "../src/spotify/app-state-oauth-token-store.js";

describe("AppStateOAuthTokenStore", () => {
  const logger: Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  it("loads tokens from AppState JSON", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "refresh",
          expiresAtEpochMs: 123,
        } satisfies OAuthTokens),
      ),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger);

    await expect(store.loadTokens()).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAtEpochMs: 123,
    });
  });

  it("returns null for invalid JSON payload", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn().mockResolvedValue("{"),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger);

    await expect(store.loadTokens()).resolves.toBeNull();
  });

  it("persists tokens under the default AppState key", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn(),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger);
    const tokens: OAuthTokens = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAtEpochMs: 123,
    };

    await store.saveTokens(tokens);

    expect(repo.setValue).toHaveBeenCalledWith(
      "spotify_oauth_tokens:auto_playlists",
      JSON.stringify(tokens),
    );
  });
});

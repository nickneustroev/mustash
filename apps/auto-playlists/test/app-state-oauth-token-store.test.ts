import { describe, expect, it, vi } from "vitest";
import type { AppStateRepository } from "../src/persistence/types.js";
import type { Logger, OAuthTokens, SpotifyTokenBinding } from "../src/shared/types.js";
import { AppStateOAuthTokenStore } from "../src/spotify/app-state-oauth-token-store.js";

describe("AppStateOAuthTokenStore", () => {
  const binding: SpotifyTokenBinding = {
    spotifyClientId: "client-id",
    spotifyRedirectUri: "http://127.0.0.1:3000/callback",
    oauthScopes: ["user-library-read", "playlist-read-private"],
  };
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
          ...binding,
        }),
      ),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger, binding);

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

    const store = new AppStateOAuthTokenStore(repo, logger, binding);

    await expect(store.loadTokens()).resolves.toBeNull();
  });

  it("drops stored tokens when spotify app binding changed", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "refresh",
          expiresAtEpochMs: 123,
          spotifyClientId: "old-client-id",
          spotifyRedirectUri: "http://127.0.0.1:3000/callback",
          oauthScopes: ["user-library-read", "playlist-read-private"],
        }),
      ),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger, binding);

    await expect(store.loadTokens()).resolves.toBeNull();
    expect(repo.deleteValue).toHaveBeenCalledWith("spotify_oauth_tokens:auto_playlists");
  });

  it("drops legacy stored tokens without spotify app binding", async () => {
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

    const store = new AppStateOAuthTokenStore(repo, logger, binding);

    await expect(store.loadTokens()).resolves.toBeNull();
    expect(repo.deleteValue).toHaveBeenCalledWith("spotify_oauth_tokens:auto_playlists");
  });

  it("drops stored tokens when oauth scopes changed", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "refresh",
          expiresAtEpochMs: 123,
          spotifyClientId: "client-id",
          spotifyRedirectUri: "http://127.0.0.1:3000/callback",
          oauthScopes: ["user-library-read"],
        }),
      ),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger, binding);

    await expect(store.loadTokens()).resolves.toBeNull();
    expect(repo.deleteValue).toHaveBeenCalledWith("spotify_oauth_tokens:auto_playlists");
  });

  it("treats oauth scopes as a set when loading stored tokens", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn().mockResolvedValue(
        JSON.stringify({
          accessToken: "access",
          refreshToken: "refresh",
          expiresAtEpochMs: 123,
          spotifyClientId: "client-id",
          spotifyRedirectUri: "http://127.0.0.1:3000/callback",
          oauthScopes: ["playlist-read-private", "user-library-read", "user-library-read"],
        }),
      ),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger, binding);

    await expect(store.loadTokens()).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAtEpochMs: 123,
    });
  });

  it("persists tokens under the default AppState key", async () => {
    const repo: AppStateRepository = {
      getValue: vi.fn(),
      setValue: vi.fn(),
      deleteValue: vi.fn(),
      close: vi.fn(),
    };

    const store = new AppStateOAuthTokenStore(repo, logger, binding);
    const tokens: OAuthTokens = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAtEpochMs: 123,
    };

    await store.saveTokens(tokens);

    expect(repo.setValue).toHaveBeenCalledWith(
      "spotify_oauth_tokens:auto_playlists",
      JSON.stringify({
        ...tokens,
        spotifyClientId: binding.spotifyClientId,
        spotifyRedirectUri: binding.spotifyRedirectUri,
        oauthScopes: ["playlist-read-private", "user-library-read"],
      }),
    );
  });
});

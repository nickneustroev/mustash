import { exec } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import type { Logger, OAuthTokenStore, OAuthTokens, SpotifyAuthConfig } from "../shared/types.js";
import { t } from "../i18n/index.js";

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}

export class AuthManager {
  private tokens: OAuthTokens | null = null;
  private readonly cfg: SpotifyAuthConfig;
  private readonly tokenStore: OAuthTokenStore;
  private readonly log: Logger;
  private readonly fetchImpl: typeof fetch;

  constructor(
    cfg: SpotifyAuthConfig,
    tokenStore: OAuthTokenStore,
    log: Logger,
    fetchImpl: typeof fetch = fetch,
  ) {
    this.cfg = cfg;
    this.tokenStore = tokenStore;
    this.log = log;
    this.fetchImpl = fetchImpl;
  }

  public async initialize(): Promise<void> {
    this.tokens = await this.tokenStore.loadTokens();

    if (!this.tokens) {
      this.log.info(t("noStoredSpotifyTokens"));
      this.tokens = await this.authorizeInteractive();
      await this.persistTokens(this.tokens);
      return;
    }

    this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
    await this.persistTokens(this.tokens);
  }

  public async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      await this.initialize();
    }

    if (!this.tokens) {
      throw new Error("Auth initialization failed: no tokens loaded.");
    }

    if (Date.now() + 5000 >= this.tokens.expiresAtEpochMs) {
      this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
      await this.persistTokens(this.tokens);
    }

    return this.tokens.accessToken;
  }

  public async handleUnauthorized(): Promise<void> {
    if (!this.tokens) {
      await this.initialize();
    }

    if (!this.tokens) {
      throw new Error("Cannot refresh token: no stored tokens.");
    }

    this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
    await this.persistTokens(this.tokens);
  }

  private async authorizeInteractive(): Promise<OAuthTokens> {
    const state = crypto.randomBytes(16).toString("hex");
    const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", this.cfg.spotifyClientId);
    authorizeUrl.searchParams.set("redirect_uri", this.cfg.spotifyRedirectUri);
    authorizeUrl.searchParams.set("scope", this.cfg.oauthScopes.join(" "));
    authorizeUrl.searchParams.set("state", state);
    const callbackPromise = this.waitForAuthCode(state, authorizeUrl.toString());

    const redirectHost = new URL(this.cfg.spotifyRedirectUri).hostname;
    if (isLoopbackHost(redirectHost)) {
      this.log.info(t("openingSpotifyAuthorization"));
      openBrowser(authorizeUrl.toString());
    } else {
      this.log.info(
        t("openSpotifyAuthorization", new URL("/", this.cfg.spotifyRedirectUri).toString()),
      );
    }
    const { code, returnedState } = await callbackPromise;
    this.log.info(t("authorizationCallbackReceived"));

    if (returnedState !== state) {
      throw new Error("OAuth state mismatch. Aborting for safety.");
    }

    return this.exchangeCodeForToken(code);
  }

  private async waitForAuthCode(
    expectedState: string,
    authorizeUrl: string,
  ): Promise<{ code: string; returnedState: string }> {
    const redirectUrl = new URL(this.cfg.spotifyRedirectUri);
    const port = resolveListenPort(redirectUrl);
    const host = redirectUrl.hostname;
    const listenHost = "0.0.0.0";
    const callbackPath = redirectUrl.pathname;

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const reqUrl = req.url ? new URL(req.url, this.cfg.spotifyRedirectUri) : null;
        if (reqUrl?.pathname === "/") {
          res.writeHead(302, { Location: authorizeUrl });
          res.end();
          return;
        }
        const isExpectedPath = reqUrl?.pathname === callbackPath;
        if (!isExpectedPath) {
          res.writeHead(404);
          res.end("Not found. Open / to start Spotify authorization.");
          return;
        }

        const code = reqUrl.searchParams.get("code");
        const returnedState = reqUrl.searchParams.get("state") ?? "";
        const err = reqUrl.searchParams.get("error");

        if (err) {
          res.writeHead(400);
          res.end(`Authorization failed: ${err}`);
          server.close();
          reject(new Error(`Spotify authorization failed: ${err}`));
          return;
        }

        if (!code) {
          res.writeHead(400);
          res.end("Missing code parameter.");
          server.close();
          reject(new Error("Authorization callback missing code parameter."));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Authorization complete. You can close this tab.");
        server.close();
        resolve({ code, returnedState });
      });

      server.on("error", (err) => reject(err));
      server.listen(port, listenHost, () => {
        this.log.info(
          t("waitingForOAuthCallback", listenHost, port, callbackPath, host),
        );
        this.log.info(t("authorizationEntrypoint", new URL("/", this.cfg.spotifyRedirectUri).toString()));
      });

      setTimeout(() => {
        server.close();
        reject(
          new Error(
            `Authorization timeout after 120s. Confirm redirect URI and login flow. Expected state: ${expectedState}`,
          ),
        );
      }, 120000).unref();
    });
  }

  private async exchangeCodeForToken(code: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.cfg.spotifyRedirectUri,
    });

    const response = await this.fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(this.cfg.spotifyClientId, this.cfg.spotifyClientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(t("spotifyTokenExchangeFailed", response.status, payload));
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    if (!data.access_token || !data.refresh_token) {
      throw new Error("Token exchange response missing required token fields.");
    }

    this.log.info(t("spotifyTokenExchangeSuccess"));

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAtEpochMs: Date.now() + data.expires_in * 1000,
    };
  }

  private async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const response = await this.fetchImpl("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: basicAuthHeader(this.cfg.spotifyClientId, this.cfg.spotifyClientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(t("spotifyTokenRefreshFailed", response.status, payload));
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    if (!data.access_token) {
      throw new Error("Token refresh response missing access token.");
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresAtEpochMs: Date.now() + data.expires_in * 1000,
    };
  }

  private async persistTokens(tokens: OAuthTokens): Promise<void> {
    await this.tokenStore.saveTokens(tokens);
  }
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function resolveListenPort(redirectUrl: URL): number {
  const fromEnv = process.env.SPOTIFY_LISTEN_PORT ?? process.env.PORT;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return Number(redirectUrl.port || (redirectUrl.protocol === "https:" ? 443 : 80));
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const value = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${value}`;
}

function openBrowser(url: string): void {
  const escaped = `"${url.replace(/"/g, '\\"')}"`;
  if (process.platform === "win32") {
    exec(`start "" ${escaped}`);
    return;
  }
  if (process.platform === "darwin") {
    exec(`open ${escaped}`);
    return;
  }
  exec(`xdg-open ${escaped}`);
}

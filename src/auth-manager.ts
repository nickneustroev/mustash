import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import { URL } from "node:url";
import { exec } from "node:child_process";
import type { AppConfig } from "./config.js";
import type { Logger, OAuthTokens } from "./types.js";

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

export class AuthManager {
  private tokens: OAuthTokens | null = null;

  constructor(
    private readonly cfg: AppConfig,
    private readonly log: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  public async initialize(): Promise<void> {
    this.tokens = await this.readTokensFromDisk();

    if (!this.tokens) {
      this.log.info("No local tokens found, starting Spotify login.");
      this.tokens = await this.authorizeInteractive();
      await this.writeTokensToDisk(this.tokens);
      return;
    }

    if (Date.now() + 15000 >= this.tokens.expiresAtEpochMs) {
      this.log.info("Access token is near expiration, refreshing.");
      this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
      await this.writeTokensToDisk(this.tokens);
    }
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
      await this.writeTokensToDisk(this.tokens);
    }

    return this.tokens.accessToken;
  }

  public async handleUnauthorized(): Promise<void> {
    if (!this.tokens) {
      await this.initialize();
    }

    if (!this.tokens) {
      throw new Error("Cannot refresh token: no local tokens.");
    }

    this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
    await this.writeTokensToDisk(this.tokens);
  }

  private async authorizeInteractive(): Promise<OAuthTokens> {
    const state = crypto.randomBytes(16).toString("hex");
    const scopes = [
      "user-read-currently-playing",
      "user-read-playback-state",
      "user-read-recently-played",
      "playlist-modify-private",
      "playlist-read-private",
    ];
    const callbackPromise = this.waitForAuthCode(state);
    const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", this.cfg.spotifyClientId);
    authorizeUrl.searchParams.set("redirect_uri", this.cfg.spotifyRedirectUri);
    authorizeUrl.searchParams.set("scope", scopes.join(" "));
    authorizeUrl.searchParams.set("state", state);

    this.log.info("Opening Spotify authorization in browser.");
    openBrowser(authorizeUrl.toString());
    const { code, returnedState } = await callbackPromise;

    if (returnedState !== state) {
      throw new Error("OAuth state mismatch. Aborting for safety.");
    }

    return this.exchangeCodeForToken(code);
  }

  private async waitForAuthCode(
    expectedState: string,
  ): Promise<{ code: string; returnedState: string }> {
    const redirectUrl = new URL(this.cfg.spotifyRedirectUri);
    const port = Number(redirectUrl.port || 80);
    const host = redirectUrl.hostname;
    const callbackPath = redirectUrl.pathname;

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const reqUrl = req.url ? new URL(req.url, this.cfg.spotifyRedirectUri) : null;
        const isExpectedPath = reqUrl?.pathname === callbackPath;
        if (!isExpectedPath) {
          res.writeHead(404);
          res.end("Not found.");
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
      server.listen(port, host, () => {
        this.log.info(`Waiting for OAuth callback on ${host}:${port} (${callbackPath})`);
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
      throw new Error(`Token exchange failed (${response.status}): ${payload}`);
    }

    const data = (await response.json()) as SpotifyTokenResponse;
    if (!data.access_token || !data.refresh_token) {
      throw new Error("Token exchange response missing required token fields.");
    }

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
      throw new Error(`Token refresh failed (${response.status}): ${payload}`);
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

  private async readTokensFromDisk(): Promise<OAuthTokens | null> {
    try {
      const raw = await fs.readFile(this.cfg.tokenStoragePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<OAuthTokens>;
      if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAtEpochMs) {
        this.log.warn("Token file exists but is invalid. A new login is required.");
        return null;
      }
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAtEpochMs: parsed.expiresAtEpochMs,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        this.log.warn("Unable to read token file, new login will be requested.");
      }
      return null;
    }
  }

  private async writeTokensToDisk(tokens: OAuthTokens): Promise<void> {
    await fs.writeFile(this.cfg.tokenStoragePath, `${JSON.stringify(tokens, null, 2)}\n`, "utf-8");
  }
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

var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { URL } from "node:url";
import { exec } from "node:child_process";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { APP_CONFIG, APP_LOGGER, FETCH_IMPL } from "../core/nest.tokens.js";
let AuthManager = class AuthManager {
    cfg;
    log;
    fetchImpl;
    tokens = null;
    constructor(cfg, log, fetchImpl = fetch) {
        this.cfg = cfg;
        this.log = log;
        this.fetchImpl = fetchImpl;
    }
    async initialize() {
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
    async getAccessToken() {
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
    async handleUnauthorized() {
        if (!this.tokens) {
            await this.initialize();
        }
        if (!this.tokens) {
            throw new Error("Cannot refresh token: no local tokens.");
        }
        this.tokens = await this.refreshAccessToken(this.tokens.refreshToken);
        await this.writeTokensToDisk(this.tokens);
    }
    async authorizeInteractive() {
        const state = crypto.randomBytes(16).toString("hex");
        const scopes = [
            "user-library-read",
            "ugc-image-upload",
            "playlist-modify-private",
            "playlist-read-private",
        ];
        const authorizeUrl = new URL("https://accounts.spotify.com/authorize");
        authorizeUrl.searchParams.set("response_type", "code");
        authorizeUrl.searchParams.set("client_id", this.cfg.spotifyClientId);
        authorizeUrl.searchParams.set("redirect_uri", this.cfg.spotifyRedirectUri);
        authorizeUrl.searchParams.set("scope", scopes.join(" "));
        authorizeUrl.searchParams.set("state", state);
        const callbackPromise = this.waitForAuthCode(state, authorizeUrl.toString());
        const redirectHost = new URL(this.cfg.spotifyRedirectUri).hostname;
        if (isLoopbackHost(redirectHost)) {
            this.log.info("Opening Spotify authorization in browser.");
            openBrowser(authorizeUrl.toString());
        }
        else {
            this.log.info(`Open ${new URL("/", this.cfg.spotifyRedirectUri).toString()} to start Spotify authorization.`);
        }
        const { code, returnedState } = await callbackPromise;
        this.log.info("Authorization callback received. Exchanging code for tokens.");
        if (returnedState !== state) {
            throw new Error("OAuth state mismatch. Aborting for safety.");
        }
        return this.exchangeCodeForToken(code);
    }
    async waitForAuthCode(expectedState, authorizeUrl) {
        const redirectUrl = new URL(this.cfg.spotifyRedirectUri);
        const port = resolveListenPort(redirectUrl);
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
                if (reqUrl?.pathname !== callbackPath) {
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
                this.log.info(`Waiting for OAuth callback on ${listenHost}:${port} (${callbackPath}).`);
            });
            setTimeout(() => {
                server.close();
                reject(new Error(`Authorization timeout after 120s. Confirm redirect URI and login flow. Expected state: ${expectedState}`));
            }, 120000).unref();
        });
    }
    async exchangeCodeForToken(code) {
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
        const data = (await response.json());
        if (!data.access_token || !data.refresh_token) {
            throw new Error("Token exchange response missing required token fields.");
        }
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAtEpochMs: Date.now() + data.expires_in * 1000,
        };
    }
    async refreshAccessToken(refreshToken) {
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
        const data = (await response.json());
        if (!data.access_token) {
            throw new Error("Token refresh response missing access token.");
        }
        return {
            accessToken: data.access_token,
            refreshToken: data.refresh_token ?? refreshToken,
            expiresAtEpochMs: Date.now() + data.expires_in * 1000,
        };
    }
    async readTokensFromDisk() {
        try {
            const stat = await fs.stat(this.cfg.tokenStoragePath);
            if (stat.isDirectory()) {
                this.log.warn(`Token storage path points to a directory, expected a file: ${this.cfg.tokenStoragePath}`);
                return null;
            }
            const raw = await fs.readFile(this.cfg.tokenStoragePath, "utf-8");
            const parsed = JSON.parse(raw);
            if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAtEpochMs) {
                this.log.warn("Token file exists but is invalid. A new login is required.");
                return null;
            }
            return {
                accessToken: parsed.accessToken,
                refreshToken: parsed.refreshToken,
                expiresAtEpochMs: parsed.expiresAtEpochMs,
            };
        }
        catch (error) {
            if (error.code !== "ENOENT") {
                const err = error;
                this.log.warn(`Unable to read token file (${this.cfg.tokenStoragePath}): ${err.code ?? "UNKNOWN"} ${err.message}`);
            }
            return null;
        }
    }
    async writeTokensToDisk(tokens) {
        await fs.mkdir(path.dirname(this.cfg.tokenStoragePath), { recursive: true });
        const existing = await fs.stat(this.cfg.tokenStoragePath).catch(() => null);
        if (existing?.isDirectory()) {
            throw new Error(`Token storage path is a directory, expected a file: ${this.cfg.tokenStoragePath}`);
        }
        await fs.writeFile(this.cfg.tokenStoragePath, `${JSON.stringify(tokens, null, 2)}\n`, "utf-8");
        this.log.info(`Spotify tokens saved to ${this.cfg.tokenStoragePath}.`);
    }
};
AuthManager = __decorate([
    Injectable(),
    __param(0, Inject(APP_CONFIG)),
    __param(1, Inject(APP_LOGGER)),
    __param(2, Optional()),
    __param(2, Inject(FETCH_IMPL)),
    __metadata("design:paramtypes", [Object, Object, Object])
], AuthManager);
export { AuthManager };
function isLoopbackHost(host) {
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
}
function resolveListenPort(redirectUrl) {
    const fromEnv = process.env.SPOTIFY_LISTEN_PORT ?? process.env.PORT;
    if (fromEnv) {
        const parsed = Number(fromEnv);
        if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
            return parsed;
        }
    }
    return Number(redirectUrl.port || (redirectUrl.protocol === "https:" ? 443 : 80));
}
function basicAuthHeader(clientId, clientSecret) {
    const value = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    return `Basic ${value}`;
}
function openBrowser(url) {
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
//# sourceMappingURL=auth-manager.js.map
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
var SpotifyClient_1;
import { Inject, Injectable, Optional } from "@nestjs/common";
import { ProxyAgent } from "undici";
import { APP_CONFIG, APP_LOGGER, AUTH_MANAGER, FETCH_IMPL } from "../core/nest.tokens.js";
import { SpotifyRateLimitError } from "../shared/errors.js";
let SpotifyClient = class SpotifyClient {
    static { SpotifyClient_1 = this; }
    auth;
    cfg;
    log;
    fetchImpl;
    static RATE_LIMIT_RETRY_ATTEMPTS = 2;
    proxyDispatcher;
    transportMode;
    rateLimitedUntilEpochMs = 0;
    constructor(auth, cfg, log, fetchImpl = fetch) {
        this.auth = auth;
        this.cfg = cfg;
        this.log = log;
        this.fetchImpl = fetchImpl;
        this.proxyDispatcher = cfg.spotifyProxyUrl ? new ProxyAgent(cfg.spotifyProxyUrl) : null;
        this.transportMode = this.canUseProxy() ? "proxy" : "direct";
    }
    async getCurrentUserId() {
        const response = await this.requestWithAuth("https://api.spotify.com/v1/me", { method: "GET" }, true);
        const payload = (await response.json());
        return payload.id;
    }
    async findPlaylistByName(name) {
        let nextUrl = "https://api.spotify.com/v1/me/playlists?limit=50";
        while (nextUrl) {
            const response = await this.requestWithAuth(nextUrl, { method: "GET" }, true);
            const payload = (await response.json());
            const found = payload.items.find((item) => item.name === name);
            if (found) {
                return found;
            }
            nextUrl = payload.next;
        }
        return null;
    }
    async createPlaylist(userId, name, description, isPrivate = true) {
        const response = await this.requestWithAuth(`https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
                public: !isPrivate,
                description,
            }),
        }, true);
        return (await response.json());
    }
    async replacePlaylistItems(playlistId, trackUris) {
        const playlistUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`;
        const head = trackUris.slice(0, 100);
        const tail = trackUris.slice(100);
        await this.requestWithAuth(playlistUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: head }),
        }, true);
        for (let i = 0; i < tail.length; i += 100) {
            const batch = tail.slice(i, i + 100);
            await this.requestWithAuth(playlistUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ uris: batch }),
            }, true);
        }
    }
    async uploadPlaylistCoverImage(playlistId, jpegBase64) {
        await this.requestWithAuth(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/images`, {
            method: "PUT",
            headers: {
                "Content-Type": "image/jpeg",
            },
            body: jpegBase64,
        }, true);
    }
    async getRecentLikedUris(limit) {
        const target = Math.max(0, limit);
        if (target === 0) {
            return [];
        }
        const uris = [];
        let offset = 0;
        while (uris.length < target) {
            const pageLimit = Math.min(50, target - uris.length);
            const url = `https://api.spotify.com/v1/me/tracks?limit=${pageLimit}&offset=${offset}`;
            const response = await this.requestWithAuth(url, { method: "GET" }, true);
            const payload = (await response.json());
            for (const item of payload.items) {
                const uri = item.track?.uri ?? deriveUriFromTrackId(item.track?.id);
                if (!uri) {
                    continue;
                }
                uris.push(uri);
                if (uris.length >= target) {
                    break;
                }
            }
            if (payload.items.length < pageLimit) {
                break;
            }
            offset += pageLimit;
        }
        return uris;
    }
    async requestWithAuth(url, init, allowRetryOnUnauthorized, rateLimitRetryAttempts = SpotifyClient_1.RATE_LIMIT_RETRY_ATTEMPTS) {
        await this.waitForRateLimitWindow();
        const accessToken = await this.auth.getAccessToken();
        const headers = new Headers(init.headers ?? {});
        headers.set("Authorization", `Bearer ${accessToken}`);
        const response = await this.fetchWithTransport(url, init, headers, this.transportMode);
        if (response.status === 401 && allowRetryOnUnauthorized) {
            this.log.warn("Spotify API returned 401, refreshing token and retrying once.");
            await this.auth.handleUnauthorized();
            return this.requestWithAuth(url, init, false, rateLimitRetryAttempts);
        }
        if (response.status === 429) {
            const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("retry-after"));
            this.bumpRateLimitWindow(retryAfterSeconds);
            if (rateLimitRetryAttempts <= 0) {
                throw new SpotifyRateLimitError(retryAfterSeconds);
            }
            this.log.warn(`Spotify API returned 429. Waiting ${retryAfterSeconds}s before retry (${rateLimitRetryAttempts} retries left).`);
            await sleep(retryAfterSeconds * 1000);
            return this.requestWithAuth(url, init, allowRetryOnUnauthorized, rateLimitRetryAttempts - 1);
        }
        if (!response.ok) {
            const payload = await response.text();
            if (this.shouldRetryWithProxy(response.status, payload)) {
                this.transportMode = "proxy";
                this.log.warn("Spotify API geo-block detected (403). Retrying request via configured proxy.");
                return this.requestWithAuth(url, init, allowRetryOnUnauthorized);
            }
            if (isSpotifyGeoBlock(response.status, payload) && !this.canUseProxy()) {
                this.log.warn("Spotify geo-block detected but proxy is not configured. Set SPOTIFY_PROXY_ENABLED=true and SPOTIFY_PROXY_URL=http://user:pass@host:port.");
            }
            throw new Error(`Spotify request failed (${response.status}): ${payload}`);
        }
        return response;
    }
    async fetchWithTransport(url, init, headers, mode) {
        const requestInit = {
            ...init,
            headers,
            signal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
        };
        if (mode === "proxy" && this.proxyDispatcher) {
            requestInit.dispatcher = this.proxyDispatcher;
        }
        return this.fetchImpl(url, requestInit);
    }
    canUseProxy() {
        return this.cfg.spotifyProxyEnabled && Boolean(this.proxyDispatcher);
    }
    shouldRetryWithProxy(status, payload) {
        return this.transportMode === "direct" && this.canUseProxy() && isSpotifyGeoBlock(status, payload);
    }
    bumpRateLimitWindow(retryAfterSeconds) {
        const candidateEpochMs = Date.now() + Math.max(0, retryAfterSeconds) * 1000;
        if (candidateEpochMs > this.rateLimitedUntilEpochMs) {
            this.rateLimitedUntilEpochMs = candidateEpochMs;
        }
    }
    async waitForRateLimitWindow() {
        const waitMs = this.rateLimitedUntilEpochMs - Date.now();
        if (waitMs <= 0) {
            return;
        }
        await sleep(waitMs);
    }
};
SpotifyClient = SpotifyClient_1 = __decorate([
    Injectable(),
    __param(0, Inject(AUTH_MANAGER)),
    __param(1, Inject(APP_CONFIG)),
    __param(2, Inject(APP_LOGGER)),
    __param(3, Optional()),
    __param(3, Inject(FETCH_IMPL)),
    __metadata("design:paramtypes", [Function, Object, Object, Object])
], SpotifyClient);
export { SpotifyClient };
function deriveUriFromTrackId(trackId) {
    return trackId ? `spotify:track:${trackId}` : null;
}
function isSpotifyGeoBlock(status, payload) {
    if (status !== 403) {
        return false;
    }
    if (payload.toLowerCase().includes("spotify is unavailable in this country")) {
        return true;
    }
    try {
        const parsed = JSON.parse(payload);
        return parsed.error?.message?.toLowerCase().includes("spotify is unavailable in this country") ?? false;
    }
    catch {
        return false;
    }
}
function parseRetryAfterSeconds(retryAfterHeader) {
    if (!retryAfterHeader) {
        return 2;
    }
    const asNumber = Number(retryAfterHeader);
    if (!Number.isNaN(asNumber) && asNumber >= 0) {
        return Math.ceil(asNumber);
    }
    const asDateMs = Date.parse(retryAfterHeader);
    if (!Number.isNaN(asDateMs)) {
        return Math.max(1, Math.ceil((asDateMs - Date.now()) / 1000));
    }
    return 2;
}
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, Math.max(0, ms));
    });
}
//# sourceMappingURL=spotify-client.js.map
import { Inject, Injectable, Optional } from "@nestjs/common";
import { ProxyAgent } from "undici";
import type { AppConfig } from "../core/config.js";
import { APP_CONFIG, APP_LOGGER, AUTH_MANAGER, FETCH_IMPL } from "../core/nest.tokens.js";
import { SpotifyRateLimitError } from "../shared/errors.js";
import type { Logger } from "../shared/types.js";
import type { AuthManager } from "./auth-manager.js";

interface SpotifyPlaylist {
  id: string;
  name: string;
}

interface SpotifyPlaylistsPage {
  items: SpotifyPlaylist[];
  next: string | null;
}

interface SpotifyTrackItem {
  id?: string;
  uri?: string;
}

interface SpotifySavedTracksPage {
  items: Array<{
    track?: SpotifyTrackItem | null;
  }>;
}

type TransportMode = "direct" | "proxy";

@Injectable()
export class SpotifyClient {
  private static readonly RATE_LIMIT_RETRY_ATTEMPTS = 2;
  private readonly proxyDispatcher: unknown | null;
  private transportMode: TransportMode;
  private rateLimitedUntilEpochMs = 0;

  constructor(
    @Inject(AUTH_MANAGER) private readonly auth: AuthManager,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @Inject(APP_LOGGER) private readonly log: Logger,
    @Optional() @Inject(FETCH_IMPL) private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.proxyDispatcher = cfg.spotifyProxyUrl ? new ProxyAgent(cfg.spotifyProxyUrl) : null;
    this.transportMode = this.canUseProxy() ? "proxy" : "direct";
  }

  public async getCurrentUserId(): Promise<string> {
    const response = await this.requestWithAuth("https://api.spotify.com/v1/me", { method: "GET" }, true);
    const payload = (await response.json()) as { id: string };
    return payload.id;
  }

  public async findPlaylistByName(name: string): Promise<SpotifyPlaylist | null> {
    let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";

    while (nextUrl) {
      const response = await this.requestWithAuth(nextUrl, { method: "GET" }, true);
      const payload = (await response.json()) as SpotifyPlaylistsPage;
      const found = payload.items.find((item) => item.name === name);
      if (found) {
        return found;
      }
      nextUrl = payload.next;
    }

    return null;
  }

  public async createPlaylist(
    userId: string,
    name: string,
    description: string,
    isPrivate = true,
  ): Promise<SpotifyPlaylist> {
    const response = await this.requestWithAuth(
      `https://api.spotify.com/v1/users/${encodeURIComponent(userId)}/playlists`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          public: !isPrivate,
          description,
        }),
      },
      true,
    );

    return (await response.json()) as SpotifyPlaylist;
  }

  public async replacePlaylistItems(playlistId: string, trackUris: string[]): Promise<void> {
    const playlistUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`;
    const head = trackUris.slice(0, 100);
    const tail = trackUris.slice(100);

    await this.requestWithAuth(
      playlistUrl,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: head }),
      },
      true,
    );

    for (let i = 0; i < tail.length; i += 100) {
      const batch = tail.slice(i, i + 100);
      await this.requestWithAuth(
        playlistUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: batch }),
        },
        true,
      );
    }
  }

  public async uploadPlaylistCoverImage(playlistId: string, jpegBase64: string): Promise<void> {
    await this.requestWithAuth(
      `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/images`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "image/jpeg",
        },
        body: jpegBase64,
      },
      true,
    );
  }

  public async getRecentLikedUris(limit: number): Promise<string[]> {
    const target = Math.max(0, limit);
    if (target === 0) {
      return [];
    }

    const uris: string[] = [];
    let offset = 0;

    while (uris.length < target) {
      const pageLimit = Math.min(50, target - uris.length);
      const url = `https://api.spotify.com/v1/me/tracks?limit=${pageLimit}&offset=${offset}`;
      const response = await this.requestWithAuth(url, { method: "GET" }, true);
      const payload = (await response.json()) as SpotifySavedTracksPage;

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

  private async requestWithAuth(
    url: string,
    init: RequestInit,
    allowRetryOnUnauthorized: boolean,
    rateLimitRetryAttempts = SpotifyClient.RATE_LIMIT_RETRY_ATTEMPTS,
  ): Promise<Response> {
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

      this.log.warn(
        `Spotify API returned 429. Waiting ${retryAfterSeconds}s before retry (${rateLimitRetryAttempts} retries left).`,
      );
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
        this.log.warn(
          "Spotify geo-block detected but proxy is not configured. Set SPOTIFY_PROXY_ENABLED=true and SPOTIFY_PROXY_URL=http://user:pass@host:port.",
        );
      }

      throw new Error(`Spotify request failed (${response.status}): ${payload}`);
    }

    return response;
  }

  private async fetchWithTransport(
    url: string,
    init: RequestInit,
    headers: Headers,
    mode: TransportMode,
  ): Promise<Response> {
    const requestInit: RequestInit = {
      ...init,
      headers,
      signal: AbortSignal.timeout(this.cfg.requestTimeoutMs),
    };

    if (mode === "proxy" && this.proxyDispatcher) {
      (requestInit as { dispatcher?: unknown }).dispatcher = this.proxyDispatcher;
    }

    return this.fetchImpl(url, requestInit);
  }

  private canUseProxy(): boolean {
    return this.cfg.spotifyProxyEnabled && Boolean(this.proxyDispatcher);
  }

  private shouldRetryWithProxy(status: number, payload: string): boolean {
    return this.transportMode === "direct" && this.canUseProxy() && isSpotifyGeoBlock(status, payload);
  }

  private bumpRateLimitWindow(retryAfterSeconds: number): void {
    const candidateEpochMs = Date.now() + Math.max(0, retryAfterSeconds) * 1000;
    if (candidateEpochMs > this.rateLimitedUntilEpochMs) {
      this.rateLimitedUntilEpochMs = candidateEpochMs;
    }
  }

  private async waitForRateLimitWindow(): Promise<void> {
    const waitMs = this.rateLimitedUntilEpochMs - Date.now();
    if (waitMs <= 0) {
      return;
    }
    await sleep(waitMs);
  }
}

function deriveUriFromTrackId(trackId: string | undefined): string | null {
  return trackId ? `spotify:track:${trackId}` : null;
}

function isSpotifyGeoBlock(status: number, payload: string): boolean {
  if (status !== 403) {
    return false;
  }

  if (payload.toLowerCase().includes("spotify is unavailable in this country")) {
    return true;
  }

  try {
    const parsed = JSON.parse(payload) as {
      error?: {
        message?: string;
      };
    };
    return parsed.error?.message?.toLowerCase().includes("spotify is unavailable in this country") ?? false;
  } catch {
    return false;
  }
}

function parseRetryAfterSeconds(retryAfterHeader: string | null): number {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

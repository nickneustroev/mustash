import type { AuthManager } from "./auth-manager.js";
import type { AppConfig } from "./config.js";
import { SpotifyRateLimitError } from "./errors.js";
import type { Logger, PlaybackSnapshot, RecentlyPlayedItem } from "./types.js";
import { ProxyAgent } from "undici";

interface SpotifyArtist {
  name?: string;
}

interface SpotifyTrackItem {
  id?: string;
  uri?: string;
  name?: string;
  artists?: SpotifyArtist[];
}

interface SpotifyCurrentlyPlayingResponse {
  is_playing?: boolean;
  currently_playing_type?: string;
  progress_ms?: number;
  item?: SpotifyTrackItem | null;
}

interface SpotifyCurrentUserResponse {
  id: string;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
}

interface SpotifyPlaylistsPage {
  items: SpotifyPlaylist[];
  next: string | null;
}

interface SpotifyRecentlyPlayedPage {
  items: Array<{
    played_at?: string;
    track?: SpotifyTrackItem | null;
  }>;
}

interface SpotifySavedTracksPage {
  items: Array<{
    added_at?: string;
    track?: SpotifyTrackItem | null;
  }>;
}

type TransportMode = "direct" | "proxy";

export class SpotifyClient {
  private readonly proxyDispatcher: unknown | null;
  private transportMode: TransportMode;

  constructor(
    private readonly auth: AuthManager,
    private readonly cfg: AppConfig,
    private readonly log: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.proxyDispatcher = cfg.spotifyProxyUrl ? new ProxyAgent(cfg.spotifyProxyUrl) : null;
    this.transportMode = this.shouldStartWithProxy() ? "proxy" : "direct";
  }

  public async getCurrentlyPlaying(): Promise<PlaybackSnapshot | null> {
    const response = await this.requestWithAuth(
      "https://api.spotify.com/v1/me/player/currently-playing",
      { method: "GET" },
      true,
    );

    if (response.status === 204) {
      return null;
    }

    const payload = (await response.json()) as SpotifyCurrentlyPlayingResponse;
    return normalizeCurrentlyPlaying(payload);
  }

  public async getCurrentUserId(): Promise<string> {
    const response = await this.requestWithAuth("https://api.spotify.com/v1/me", { method: "GET" }, true);
    const payload = (await response.json()) as SpotifyCurrentUserResponse;
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

    const payload = (await response.json()) as SpotifyPlaylist;
    return payload;
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

  public async getRecentlyPlayed(limit: number): Promise<RecentlyPlayedItem[]> {
    const beforeEpochMs = Date.now();
    const url = `https://api.spotify.com/v1/me/player/recently-played?limit=${encodeURIComponent(String(limit))}&before=${encodeURIComponent(String(beforeEpochMs))}`;
    const response = await this.requestWithAuth(url, { method: "GET" }, true);
    const payload = (await response.json()) as SpotifyRecentlyPlayedPage;

    return payload.items
      .map((item) => {
        const playedAt = item.played_at ? Date.parse(item.played_at) : NaN;
        const uri = item.track?.uri ?? deriveUriFromTrackId(item.track?.id);
        if (!uri || Number.isNaN(playedAt)) {
          return null;
        }
        return {
          trackUri: uri,
          trackName: item.track?.name ?? null,
          artistName: item.track?.artists?.[0]?.name ?? null,
          playedAtEpochMs: playedAt,
        } satisfies RecentlyPlayedItem;
      })
      .filter((item): item is RecentlyPlayedItem => item !== null);
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

  private async requestWithAuth(url: string, init: RequestInit, allowRetryOnUnauthorized: boolean): Promise<Response> {
    const accessToken = await this.auth.getAccessToken();
    const headers = new Headers(init.headers ?? {});
    headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await this.fetchWithTransport(url, init, headers, this.transportMode);

    if (response.status === 401 && allowRetryOnUnauthorized) {
      this.log.warn("Spotify API returned 401, refreshing token and retrying once.");
      await this.auth.handleUnauthorized();
      return this.requestWithAuth(url, init, false);
    }

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterSeconds = Number(retryAfterHeader ?? "2");
      throw new SpotifyRateLimitError(Number.isNaN(retryAfterSeconds) ? 2 : retryAfterSeconds);
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

  private shouldStartWithProxy(): boolean {
    return this.canUseProxy() && !this.cfg.spotifyProxyOnGeoBlockOnly;
  }

  private canUseProxy(): boolean {
    return this.cfg.spotifyProxyEnabled && Boolean(this.proxyDispatcher);
  }

  private shouldRetryWithProxy(status: number, payload: string): boolean {
    return this.transportMode === "direct" && this.canUseProxy() && isSpotifyGeoBlock(status, payload);
  }
}

export function normalizeCurrentlyPlaying(payload: SpotifyCurrentlyPlayingResponse): PlaybackSnapshot {
  const rawType = payload.currently_playing_type ?? "unknown";
  const itemType = toItemType(rawType);
  const track = payload.item ?? null;
  const trackId = itemType === "track" ? track?.id ?? null : null;
  const trackUri = itemType === "track" ? track?.uri ?? deriveUriFromTrackId(track?.id) : null;

  return {
    isPlaying: Boolean(payload.is_playing),
    itemType,
    trackId,
    trackUri,
    trackName: itemType === "track" ? track?.name ?? null : null,
    artists:
      itemType === "track"
        ? (track?.artists ?? []).map((artist) => artist.name).filter((name): name is string => Boolean(name))
        : [],
    progressMs: typeof payload.progress_ms === "number" ? payload.progress_ms : null,
    fetchedAtEpochMs: Date.now(),
  };
}

function toItemType(type: string): PlaybackSnapshot["itemType"] {
  if (type === "track" || type === "episode" || type === "ad") {
    return type;
  }
  return "unknown";
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

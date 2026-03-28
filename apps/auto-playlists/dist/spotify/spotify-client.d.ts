import type { AppConfig } from "../core/config.js";
import type { Logger } from "../shared/types.js";
import type { AuthManager } from "./auth-manager.js";
interface SpotifyPlaylist {
    id: string;
    name: string;
}
export declare class SpotifyClient {
    private readonly auth;
    private readonly cfg;
    private readonly log;
    private readonly fetchImpl;
    private static readonly RATE_LIMIT_RETRY_ATTEMPTS;
    private readonly proxyDispatcher;
    private transportMode;
    private rateLimitedUntilEpochMs;
    constructor(auth: AuthManager, cfg: AppConfig, log: Logger, fetchImpl?: typeof fetch);
    getCurrentUserId(): Promise<string>;
    findPlaylistByName(name: string): Promise<SpotifyPlaylist | null>;
    createPlaylist(userId: string, name: string, description: string, isPrivate?: boolean): Promise<SpotifyPlaylist>;
    replacePlaylistItems(playlistId: string, trackUris: string[]): Promise<void>;
    uploadPlaylistCoverImage(playlistId: string, jpegBase64: string): Promise<void>;
    getRecentLikedUris(limit: number): Promise<string[]>;
    private requestWithAuth;
    private fetchWithTransport;
    private canUseProxy;
    private shouldRetryWithProxy;
    private bumpRateLimitWindow;
    private waitForRateLimitWindow;
}
export {};
//# sourceMappingURL=spotify-client.d.ts.map
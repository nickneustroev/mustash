import type { Logger } from "../../shared/types.js";
import type { SpotifyClient } from "../../spotify/spotify-client.js";
interface LikedRecentSyncOptions {
    windows: number[];
    playlistPrefix: string;
    playlistSuffix: string;
    syncIntervalMs: number;
    playlistPrivate: boolean;
}
export declare class LikedRecentSyncService {
    private readonly spotifyClient;
    private readonly logger;
    private readonly options;
    private timer;
    private running;
    private stopped;
    private nextAllowedSyncAtEpochMs;
    private readonly playlistIdsByWindow;
    private readonly lastHashesByWindow;
    constructor(spotifyClient: SpotifyClient, logger: Logger, options: LikedRecentSyncOptions);
    start(): void;
    stop(): void;
    syncNow(): Promise<void>;
    private ensurePlaylists;
}
export declare function buildLikedRecentPlaylistName(prefix: string, suffix: string, windowSize: number): string;
export declare function hashUris(uris: string[]): string;
export {};
//# sourceMappingURL=liked-recent-sync-service.d.ts.map
export interface AppConfig {
    spotifyClientId: string;
    spotifyClientSecret: string;
    spotifyRedirectUri: string;
    tokenStoragePath: string;
    requestTimeoutMs: number;
    likedRecentEnabled: boolean;
    likedRecentWindows: number[];
    likedRecentPlaylistPrefix: string;
    likedRecentPlaylistSuffix: string;
    likedRecentSyncIntervalMs: number;
    likedRecentPlaylistPrivate: boolean;
    spotifyProxyEnabled: boolean;
    spotifyProxyUrl: string;
}
export declare function loadConfig(): AppConfig;
export declare function getSafeConfigForLogs(cfg: AppConfig): Record<string, string | number | boolean>;
export declare function parseLikedRecentWindows(value: string): number[];
//# sourceMappingURL=config.d.ts.map
import { SpotifyRateLimitError } from "../../shared/errors.js";
import { generateRecentPlaylistCoverJpeg } from "./playlist-cover.js";
export class LikedRecentSyncService {
    spotifyClient;
    logger;
    options;
    timer = null;
    running = false;
    stopped = true;
    nextAllowedSyncAtEpochMs = 0;
    playlistIdsByWindow = new Map();
    lastHashesByWindow = new Map();
    constructor(spotifyClient, logger, options) {
        this.spotifyClient = spotifyClient;
        this.logger = logger;
        this.options = options;
    }
    start() {
        if (this.options.windows.length === 0) {
            this.logger.warn("Liked recent sync is enabled but windows list is empty. Service disabled.");
            return;
        }
        this.stopped = false;
        void this.syncNow();
        this.timer = setInterval(() => {
            void this.syncNow();
        }, this.options.syncIntervalMs);
        this.logger.info(`Liked recent sync started (windows=${this.options.windows.join(",")}, interval=${this.options.syncIntervalMs}ms).`);
    }
    stop() {
        this.stopped = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.logger.info("Liked recent sync stopped.");
    }
    async syncNow() {
        if (this.stopped || this.running) {
            return;
        }
        if (Date.now() < this.nextAllowedSyncAtEpochMs) {
            return;
        }
        this.running = true;
        try {
            await this.ensurePlaylists();
            const maxWindow = this.options.windows[this.options.windows.length - 1] ?? 0;
            const likedUris = await this.spotifyClient.getRecentLikedUris(maxWindow);
            for (const windowSize of this.options.windows) {
                const playlistId = this.playlistIdsByWindow.get(windowSize);
                if (!playlistId) {
                    continue;
                }
                const windowUris = likedUris.slice(0, windowSize);
                const hash = hashUris(windowUris);
                if (this.lastHashesByWindow.get(windowSize) === hash) {
                    continue;
                }
                await this.spotifyClient.replacePlaylistItems(playlistId, windowUris);
                this.lastHashesByWindow.set(windowSize, hash);
                this.logger.info(`Liked recent playlist synced (${buildLikedRecentPlaylistName(this.options.playlistPrefix, this.options.playlistSuffix, windowSize)}, ${windowUris.length} items).`);
            }
        }
        catch (error) {
            if (error instanceof SpotifyRateLimitError) {
                this.nextAllowedSyncAtEpochMs = Date.now() + error.retryAfterSeconds * 1000;
                this.logger.warn(`Liked recent sync rate-limited. Retry after ${error.retryAfterSeconds}s. Next attempt after ${new Date(this.nextAllowedSyncAtEpochMs).toISOString()}.`);
            }
            else {
                this.logger.warn(`Liked recent sync failed: ${error.message}`);
            }
        }
        finally {
            this.running = false;
        }
    }
    async ensurePlaylists() {
        const userId = await this.spotifyClient.getCurrentUserId();
        for (const windowSize of this.options.windows) {
            if (this.playlistIdsByWindow.has(windowSize)) {
                continue;
            }
            const playlistName = buildLikedRecentPlaylistName(this.options.playlistPrefix, this.options.playlistSuffix, windowSize);
            const existing = await this.spotifyClient.findPlaylistByName(playlistName);
            if (existing) {
                this.playlistIdsByWindow.set(windowSize, existing.id);
                continue;
            }
            const created = await this.spotifyClient.createPlaylist(userId, playlistName, `Auto-maintained recent liked tracks (${windowSize}).`, this.options.playlistPrivate);
            this.playlistIdsByWindow.set(windowSize, created.id);
            this.logger.info(`Liked recent playlist created (${playlistName}).`);
            try {
                const coverJpeg = await generateRecentPlaylistCoverJpeg(windowSize);
                await this.spotifyClient.uploadPlaylistCoverImage(created.id, coverJpeg.toString("base64"));
                this.logger.info(`Liked recent playlist cover uploaded (${playlistName}).`);
            }
            catch (error) {
                this.logger.warn(`Failed to upload cover for playlist ${playlistName}: ${error.message}`);
            }
        }
    }
}
export function buildLikedRecentPlaylistName(prefix, suffix, windowSize) {
    return `${prefix} ${windowSize} ${suffix}`.replace(/\s+/g, " ").trim();
}
export function hashUris(uris) {
    return `${uris.length}:${uris.join("|")}`;
}
//# sourceMappingURL=liked-recent-sync-service.js.map
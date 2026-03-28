export class SpotifyRateLimitError extends Error {
    retryAfterSeconds;
    constructor(retryAfterSeconds) {
        super(`Spotify rate limit reached. Retry after ${retryAfterSeconds}s`);
        this.name = "SpotifyRateLimitError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
//# sourceMappingURL=errors.js.map
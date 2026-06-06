export const messages = {
  receivedSignalShuttingDown: (signal: string) => `Received ${signal}, shutting down.`,

  configLoaded: (config: string) => `Config loaded: ${config}`,
  spotifyAuthReady: "Spotify auth is ready.",
  stopping: (signal: string) => `Stopping (${signal}).`,

  trackWatcherStarted: (pollIntervalMs: number) =>
    `Track watcher started. Poll interval: ${pollIntervalMs}ms`,
  trackWatcherStopped: "Track watcher stopped.",
  spotifyRateLimitedBackingOff: (delayMs: number) =>
    `Spotify rate limited requests. Backing off for ${delayMs}ms before next poll.`,
  pollingFailed: (message: string, delayMs: number) =>
    `Polling failed: ${message}. Next attempt in ${delayMs}ms.`,

  trackNotification: (artists: string, trackName: string) => `TRACK ${artists} - ${trackName}`,

  noPlaylistDefinitionsConfigured: "No playlist definitions are configured.",
  syncActive: (mode: string, definitions: number, interval: number, initialDelay: number) =>
    `Sync now is active (${mode}, definitions=${definitions}, interval=${interval}ms, initialDelay=${initialDelay}ms).`,
  syncStopped: (mode: string) => `Sync stopped (${mode}).`,
  syncCycleStarted: (mode: string) => `Sync cycle started (${mode}).`,
  playlistNoLongerAvailable: (name: string) =>
    `Playlist "${name}" is no longer available. Cached id dropped, will recreate on next sync.`,
  syncedPlaylist: (name: string, count: number) => `Synced "${name}" - ${count} items.`,
  syncCycleCompleted: (mode: string, updated: number, total: number) =>
    `Sync cycle completed (${mode}, updated=${updated}/${total}).`,
  syncRateLimited: (retryAfter: number, nextAttempt: string) =>
    `Sync rate-limited. Retry after ${retryAfter}s. Next attempt after ${nextAttempt}.`,
  syncFailed: (mode: string, message: string) => `Sync failed (${mode}): ${message}`,
  playlistCreated: (name: string) => `Created (${name}).`,
  coverUploaded: (name: string) => `Cover uploaded (${name}).`,
  coverUploadFailed: (name: string, message: string) =>
    `Failed to upload cover for playlist ${name}: ${message}`,
  archivedRemovedTrack: (artist: string, track: string, trackId: string) =>
    `Archived removed track: ${artist} - ${track} (${trackId}).`,
  savedTracksSnapshotInvalid: "Saved tracks snapshot in AppState is invalid. Rebuilding snapshot.",

  databaseUrlEmpty:
    "DATABASE_URL is not set. The application will run without DB-dependent features: saved tracks and removed tracks archive are disabled.",
  databaseClientNotCreated:
    "Database connection detected but DB client was not created. The application will run without DB-dependent features.",
  databaseConnected:
    "Database connection detected and verified. The application will use features that store data in the database.",
  databaseConnectionFailed: (message: string) =>
    `Database connection detected but unable to connect: ${message}. The application will run without DB-dependent features.`,

  prismaDisconnectFailed: (message: string) => `Prisma disconnect failed: ${message}`,

  spotifyTokenInvalid: (key: string) =>
    `Spotify token payload in AppState key "${key}" is invalid.`,
  spotifyTokenParseFailed: (key: string, message: string) =>
    `Unable to parse Spotify token payload from AppState key "${key}": ${message}`,
  spotifyTokensSaved: (key: string) => `Spotify tokens saved to AppState key "${key}".`,

  noStoredSpotifyTokens: "No stored Spotify tokens found, starting login.",
  accessTokenNearExpiration: "Access token is near expiration, refreshing.",
  openingSpotifyAuthorization: "Opening Spotify authorization in browser.",
  openSpotifyAuthorization: (url: string) =>
    `Open ${url} to start Spotify authorization.`,
  authorizationCallbackReceived: "Authorization callback received. Exchanging code for tokens.",
  waitingForOAuthCallback: (host: string, port: number, path: string, redirectHost: string) =>
    `Waiting for OAuth callback on ${host}:${port} (${path}), redirect URI host: ${redirectHost}`,
  authorizationEntrypoint: (url: string) => `Authorization entrypoint: ${url}`,
  spotifyTokenExchangeSuccess: "Spotify token exchange completed successfully.",

  spotifyApi401: "Spotify API returned 401, refreshing token and retrying once.",
  spotifyApi429: (requestDescription: string, retryAfter: number, retriesLeft: number) =>
    `Spotify API returned 429 for ${requestDescription}. Waiting ${retryAfter}s before retry (${retriesLeft} retries left).`,
  spotifyGeoBlockProxy: "Spotify API geo-block detected (403). Retrying request via configured proxy.",
  spotifyGeoBlockNoProxy:
    "Spotify geo-block detected but proxy is not configured. Set SPOTIFY_PROXY_ENABLED=true and SPOTIFY_PROXY_URL=http://user:pass@host:port.",

  liveTrackSaved: (uri: string, at: string) => `Live track saved: ${uri} at ${at}.`,
  liveTrackAlreadyExists: (uri: string, at: string) =>
    `Live track already exists, refreshed metadata: ${uri} at ${at}.`,
} as const;

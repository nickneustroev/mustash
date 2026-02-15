import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";

const likedWindowsSchema = z.string().default("20,50,100").transform((value) => parseLikedRecentWindows(value));

const schema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().url(),
  POLL_INTERVAL_MS: z.coerce.number().int().min(500).default(2500),
  PRINT_ON_START: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(true),
  TOKEN_STORAGE_PATH: z.string().default(".spotify-tokens.json"),
  HISTORY_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .default(false),
  HISTORY_PLAYLIST_NAME: z.string().min(1).default("HISTORY [AUTO]"),
  HISTORY_MAX_ITEMS: z.coerce.number().int().min(1).max(100).default(100),
  HISTORY_STATE_PATH: z.string().default(".history-state.json"),
  PLAYLIST_SYNC_DEBOUNCE_MS: z.coerce.number().int().min(500).default(7000),
  BACKFILL_INTERVAL_MS: z.coerce.number().int().min(5000).default(60000),
  BACKFILL_LIMIT: z.coerce.number().int().min(1).max(50).default(50),
  LIKED_RECENT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  LIKED_RECENT_WINDOWS: likedWindowsSchema,
  LIKED_RECENT_PLAYLIST_PREFIX: z.string().min(1).default("LIKED RECENT"),
  LIKED_RECENT_PLAYLIST_SUFFIX: z.string().min(1).default("[AUTO]"),
  LIKED_RECENT_SYNC_INTERVAL_MS: z.coerce.number().int().min(5000).default(15000),
  LIKED_RECENT_PLAYLIST_PRIVATE: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .default(true),
});

export interface AppConfig {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  pollIntervalMs: number;
  printOnStart: boolean;
  tokenStoragePath: string;
  requestTimeoutMs: number;
  historyEnabled: boolean;
  historyPlaylistName: string;
  historyMaxItems: number;
  historyStatePath: string;
  playlistSyncDebounceMs: number;
  backfillIntervalMs: number;
  backfillLimit: number;
  likedRecentEnabled: boolean;
  likedRecentWindows: number[];
  likedRecentPlaylistPrefix: string;
  likedRecentPlaylistSuffix: string;
  likedRecentSyncIntervalMs: number;
  likedRecentPlaylistPrivate: boolean;
}

export function loadConfig(): AppConfig {
  loadEnv();
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment config: ${details}`);
  }

  const env = parsed.data;

  return {
    spotifyClientId: env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: env.SPOTIFY_CLIENT_SECRET,
    spotifyRedirectUri: env.SPOTIFY_REDIRECT_URI,
    pollIntervalMs: env.POLL_INTERVAL_MS,
    printOnStart: env.PRINT_ON_START,
    tokenStoragePath: path.resolve(process.cwd(), env.TOKEN_STORAGE_PATH),
    requestTimeoutMs: 5000,
    historyEnabled: env.HISTORY_ENABLED,
    historyPlaylistName: env.HISTORY_PLAYLIST_NAME,
    historyMaxItems: env.HISTORY_MAX_ITEMS,
    historyStatePath: path.resolve(process.cwd(), env.HISTORY_STATE_PATH),
    playlistSyncDebounceMs: env.PLAYLIST_SYNC_DEBOUNCE_MS,
    backfillIntervalMs: env.BACKFILL_INTERVAL_MS,
    backfillLimit: env.BACKFILL_LIMIT,
    likedRecentEnabled: env.LIKED_RECENT_ENABLED,
    likedRecentWindows: env.LIKED_RECENT_WINDOWS,
    likedRecentPlaylistPrefix: env.LIKED_RECENT_PLAYLIST_PREFIX,
    likedRecentPlaylistSuffix: env.LIKED_RECENT_PLAYLIST_SUFFIX,
    likedRecentSyncIntervalMs: env.LIKED_RECENT_SYNC_INTERVAL_MS,
    likedRecentPlaylistPrivate: env.LIKED_RECENT_PLAYLIST_PRIVATE,
  };
}

export function getSafeConfigForLogs(cfg: AppConfig): Record<string, string | number | boolean> {
  return {
    spotifyClientId: cfg.spotifyClientId,
    spotifyRedirectUri: cfg.spotifyRedirectUri,
    pollIntervalMs: cfg.pollIntervalMs,
    printOnStart: cfg.printOnStart,
    tokenStoragePath: cfg.tokenStoragePath,
    requestTimeoutMs: cfg.requestTimeoutMs,
    historyEnabled: cfg.historyEnabled,
    historyPlaylistName: cfg.historyPlaylistName,
    historyMaxItems: cfg.historyMaxItems,
    historyStatePath: cfg.historyStatePath,
    playlistSyncDebounceMs: cfg.playlistSyncDebounceMs,
    backfillIntervalMs: cfg.backfillIntervalMs,
    backfillLimit: cfg.backfillLimit,
    likedRecentEnabled: cfg.likedRecentEnabled,
    likedRecentWindows: cfg.likedRecentWindows.join(","),
    likedRecentPlaylistPrefix: cfg.likedRecentPlaylistPrefix,
    likedRecentPlaylistSuffix: cfg.likedRecentPlaylistSuffix,
    likedRecentSyncIntervalMs: cfg.likedRecentSyncIntervalMs,
    likedRecentPlaylistPrivate: cfg.likedRecentPlaylistPrivate,
  };
}

export function parseLikedRecentWindows(value: string): number[] {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    throw new Error("LIKED_RECENT_WINDOWS must contain at least one window size.");
  }

  const parsed = tokens.map((token) => Number(token));
  for (const num of parsed) {
    if (!Number.isInteger(num) || num <= 0 || num > 1000) {
      throw new Error(`Invalid liked recent window "${num}". Allowed range: 1..1000.`);
    }
  }

  return Array.from(new Set(parsed)).sort((a, b) => a - b);
}

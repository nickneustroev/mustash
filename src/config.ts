import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";

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
  HISTORY_PLAYLIST_NAME: z.string().min(1).default("HISTORY [AUTO]"),
  HISTORY_MAX_ITEMS: z.coerce.number().int().min(1).max(100).default(100),
  HISTORY_STATE_PATH: z.string().default(".history-state.json"),
  PLAYLIST_SYNC_DEBOUNCE_MS: z.coerce.number().int().min(500).default(7000),
  BACKFILL_INTERVAL_MS: z.coerce.number().int().min(5000).default(60000),
  BACKFILL_LIMIT: z.coerce.number().int().min(1).max(50).default(50),
});

export interface AppConfig {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  pollIntervalMs: number;
  printOnStart: boolean;
  tokenStoragePath: string;
  requestTimeoutMs: number;
  historyPlaylistName: string;
  historyMaxItems: number;
  historyStatePath: string;
  playlistSyncDebounceMs: number;
  backfillIntervalMs: number;
  backfillLimit: number;
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
    historyPlaylistName: env.HISTORY_PLAYLIST_NAME,
    historyMaxItems: env.HISTORY_MAX_ITEMS,
    historyStatePath: path.resolve(process.cwd(), env.HISTORY_STATE_PATH),
    playlistSyncDebounceMs: env.PLAYLIST_SYNC_DEBOUNCE_MS,
    backfillIntervalMs: env.BACKFILL_INTERVAL_MS,
    backfillLimit: env.BACKFILL_LIMIT,
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
    historyPlaylistName: cfg.historyPlaylistName,
    historyMaxItems: cfg.historyMaxItems,
    historyStatePath: cfg.historyStatePath,
    playlistSyncDebounceMs: cfg.playlistSyncDebounceMs,
    backfillIntervalMs: cfg.backfillIntervalMs,
    backfillLimit: cfg.backfillLimit,
  };
}

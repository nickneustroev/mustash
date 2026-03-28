import { config as loadEnv } from "dotenv";
import path from "node:path";
import { z } from "zod";

const likedWindowsSchema = z.string().default("20,50,100").transform((value) => parseLikedRecentWindows(value));

const schema = z.object({
  SPOTIFY_CLIENT_ID: z.string().min(1),
  SPOTIFY_CLIENT_SECRET: z.string().min(1),
  SPOTIFY_REDIRECT_URI: z.string().url(),
  TOKEN_STORAGE_PATH: z.string().default("data/.spotify-tokens.json"),
  LIKED_RECENT_ENABLED: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .default(true),
  LIKED_RECENT_WINDOWS: likedWindowsSchema,
  LIKED_RECENT_PLAYLIST_PREFIX: z.string().min(1).default("LIKED RECENT"),
  LIKED_RECENT_PLAYLIST_SUFFIX: z.string().min(1).default("[AUTO]"),
  LIKED_RECENT_SYNC_INTERVAL_MS: z.coerce.number().int().min(5000).default(15000),
  LIKED_RECENT_PLAYLIST_PRIVATE: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .default(true),
  SPOTIFY_PROXY_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  SPOTIFY_PROXY_URL: z.string().default(""),
});

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

export function loadConfig(): AppConfig {
  loadAppEnv(".env.auto-playlists");
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
    tokenStoragePath: path.resolve(process.cwd(), env.TOKEN_STORAGE_PATH),
    requestTimeoutMs: 5000,
    likedRecentEnabled: env.LIKED_RECENT_ENABLED,
    likedRecentWindows: env.LIKED_RECENT_WINDOWS,
    likedRecentPlaylistPrefix: env.LIKED_RECENT_PLAYLIST_PREFIX,
    likedRecentPlaylistSuffix: env.LIKED_RECENT_PLAYLIST_SUFFIX,
    likedRecentSyncIntervalMs: env.LIKED_RECENT_SYNC_INTERVAL_MS,
    likedRecentPlaylistPrivate: env.LIKED_RECENT_PLAYLIST_PRIVATE,
    spotifyProxyEnabled: env.SPOTIFY_PROXY_ENABLED,
    spotifyProxyUrl: env.SPOTIFY_PROXY_URL,
  };
}

function loadAppEnv(appEnvFile: string): void {
  loadEnv({ path: path.resolve(process.cwd(), appEnvFile) });
  loadEnv();
}

export function getSafeConfigForLogs(cfg: AppConfig): Record<string, string | number | boolean> {
  return {
    spotifyClientId: cfg.spotifyClientId,
    spotifyRedirectUri: cfg.spotifyRedirectUri,
    tokenStoragePath: cfg.tokenStoragePath,
    requestTimeoutMs: cfg.requestTimeoutMs,
    likedRecentEnabled: cfg.likedRecentEnabled,
    likedRecentWindows: cfg.likedRecentWindows.join(","),
    likedRecentPlaylistPrefix: cfg.likedRecentPlaylistPrefix,
    likedRecentPlaylistSuffix: cfg.likedRecentPlaylistSuffix,
    likedRecentSyncIntervalMs: cfg.likedRecentSyncIntervalMs,
    likedRecentPlaylistPrivate: cfg.likedRecentPlaylistPrivate,
    spotifyProxyEnabled: cfg.spotifyProxyEnabled,
    spotifyProxyConfigured: cfg.spotifyProxyUrl.length > 0,
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

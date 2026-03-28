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
  TOKEN_STORAGE_PATH: z.string().default("data/.spotify-tokens.json"),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  BACKFILL_INTERVAL_MS: z.coerce.number().int().min(5000).default(60000),
  BACKFILL_LIMIT: z.coerce.number().int().min(1).max(50).default(50),
  SPOTIFY_PROXY_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  SPOTIFY_PROXY_URL: z.string().default(""),
  SAVED_TRACKS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  SAVED_TRACKS_SYNC_INTERVAL_MS: z.coerce.number().int().min(15000).default(60000),
  // S3 Backup Configuration
  S3_ENDPOINT: z.string().url().default("https://s3.timeweb.cloud"),
  S3_BUCKET: z.string().min(1).default("backups"),
  S3_PREFIX: z.string().min(1).default("backups"),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  BACKUP_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true")
    .default(false),
  BACKUP_CRON: z.string().default("0 0 * * *"), // Daily at 00:00 UTC
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(1).default(7),
});

export interface AppConfig {
  spotifyClientId: string;
  spotifyClientSecret: string;
  spotifyRedirectUri: string;
  pollIntervalMs: number;
  printOnStart: boolean;
  tokenStoragePath: string;
  databaseUrl: string;
  requestTimeoutMs: number;
  backfillIntervalMs: number;
  backfillLimit: number;
  spotifyProxyEnabled: boolean;
  spotifyProxyUrl: string;
  savedTracksEnabled: boolean;
  savedTracksSyncIntervalMs: number;
  // S3 Backup Configuration
  s3Endpoint: string;
  s3Bucket: string;
  s3Prefix: string;
  s3AccessKey: string | undefined;
  s3SecretKey: string | undefined;
  backupEnabled: boolean;
  backupCron: string;
  backupRetentionDays: number;
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
    databaseUrl: env.DATABASE_URL,
    requestTimeoutMs: 5000,
    backfillIntervalMs: env.BACKFILL_INTERVAL_MS,
    backfillLimit: env.BACKFILL_LIMIT,
    spotifyProxyEnabled: env.SPOTIFY_PROXY_ENABLED,
    spotifyProxyUrl: env.SPOTIFY_PROXY_URL,
    savedTracksEnabled: env.SAVED_TRACKS_ENABLED,
    savedTracksSyncIntervalMs: env.SAVED_TRACKS_SYNC_INTERVAL_MS,
    // S3 Backup Configuration
    s3Endpoint: env.S3_ENDPOINT,
    s3Bucket: env.S3_BUCKET,
    s3Prefix: env.S3_PREFIX.replace(/^\/+|\/+$/g, ""),
    s3AccessKey: env.S3_ACCESS_KEY,
    s3SecretKey: env.S3_SECRET_KEY,
    backupEnabled: env.BACKUP_ENABLED,
    backupCron: env.BACKUP_CRON,
    backupRetentionDays: env.BACKUP_RETENTION_DAYS,
  };
}

export function getSafeConfigForLogs(cfg: AppConfig): Record<string, string | number | boolean> {
  return {
    spotifyClientId: cfg.spotifyClientId,
    spotifyRedirectUri: cfg.spotifyRedirectUri,
    pollIntervalMs: cfg.pollIntervalMs,
    printOnStart: cfg.printOnStart,
    tokenStoragePath: cfg.tokenStoragePath,
    databaseUrl: cfg.databaseUrl,
    requestTimeoutMs: cfg.requestTimeoutMs,
    backfillIntervalMs: cfg.backfillIntervalMs,
    backfillLimit: cfg.backfillLimit,
    spotifyProxyEnabled: cfg.spotifyProxyEnabled,
    spotifyProxyConfigured: cfg.spotifyProxyUrl.length > 0,
    savedTracksEnabled: cfg.savedTracksEnabled,
    savedTracksSyncIntervalMs: cfg.savedTracksSyncIntervalMs,
    s3Endpoint: cfg.s3Endpoint,
    s3Bucket: cfg.s3Bucket,
    s3Prefix: cfg.s3Prefix,
    backupEnabled: cfg.backupEnabled,
    backupCron: cfg.backupCron,
    backupRetentionDays: cfg.backupRetentionDays,
  };
}

import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { logger } from "../core/logger.js";

interface RestoreConfig {
  databasePath: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3Prefix: string;
  s3AccessKey: string | undefined;
  s3SecretKey: string | undefined;
  restoreOnEmptyDb: boolean;
}

interface BackupObject {
  key: string;
  lastModified: Date;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined)
    return fallback;
  return value.trim().toLowerCase() === "true";
}

function getDatabasePath(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`S3 restore supports only SQLite DATABASE_URL with file:, got: ${databaseUrl}`);
  }

  let dbPath = databaseUrl.slice("file:".length);

  if (dbPath.startsWith("//"))
    dbPath = dbPath.replace(/^\/+/, "");

  if (!dbPath.startsWith("/"))
    dbPath = join(process.cwd(), dbPath);

  return dbPath;
}

function loadRestoreConfig(): RestoreConfig {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const s3PrefixRaw = process.env.S3_PREFIX ?? "backups";

  return {
    databasePath: getDatabasePath(databaseUrl),
    s3Endpoint: process.env.S3_ENDPOINT ?? "https://s3.timeweb.cloud",
    s3Bucket: process.env.S3_BUCKET ?? "backups",
    s3Prefix: s3PrefixRaw.replace(/^\/+|\/+$/g, ""),
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    restoreOnEmptyDb: parseBoolean(process.env.S3_RESTORE_ON_EMPTY_DB, true),
  };
}

function databaseExists(databasePath: string): boolean {
  if (!existsSync(databasePath))
    return false;

  const stats = statSync(databasePath);
  return stats.isFile() && stats.size > 0;
}

function ensureDatabaseDir(databasePath: string): void {
  const dirPath = dirname(databasePath);
  mkdirSync(dirPath, { recursive: true });
}

function createS3Client(config: RestoreConfig): S3Client {
  return new S3Client({
    endpoint: config.s3Endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: config.s3AccessKey!,
      secretAccessKey: config.s3SecretKey!,
    },
    forcePathStyle: true,
  });
}

async function findLatestBackup(s3Client: S3Client, bucket: string, prefix: string): Promise<BackupObject | null> {
  let continuationToken: string | undefined;
  let latest: BackupObject | null = null;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${prefix}/`,
      ContinuationToken: continuationToken,
    }));

    for (const item of response.Contents ?? []) {
      if (!item.Key || !item.LastModified)
        continue;

      if (!latest || item.LastModified > latest.lastModified)
        latest = { key: item.Key, lastModified: item.LastModified };
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return latest;
}

async function downloadBackup(s3Client: S3Client, bucket: string, key: string, targetPath: string): Promise<void> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  }));

  const body = response.Body;
  if (!body || !("transformToByteArray" in body) || typeof body.transformToByteArray !== "function") {
    throw new Error(`Unexpected S3 response body for key=${key}`);
  }

  const bytes = await body.transformToByteArray();
  if (bytes.length === 0) {
    throw new Error(`Downloaded backup is empty: key=${key}`);
  }

  const tempPath = `${targetPath}.restore-tmp`;
  writeFileSync(tempPath, Buffer.from(bytes));
  renameSync(tempPath, targetPath);
}

export async function restoreDatabaseIfNeeded(): Promise<void> {
  const config = loadRestoreConfig();
  const { databasePath } = config;

  if (!config.restoreOnEmptyDb) {
    logger.info("S3 restore on empty DB is disabled, skipping");
    return;
  }

  if (databaseExists(databasePath)) {
    logger.info(`Database already exists in volume, skipping restore: dbPath=${databasePath}`);
    return;
  }

  ensureDatabaseDir(databasePath);

  if (!config.s3AccessKey || !config.s3SecretKey) {
    logger.warn("Database is missing, but S3_ACCESS_KEY/S3_SECRET_KEY are not configured. Starting with empty DB.");
    return;
  }

  const s3Client = createS3Client(config);
  const latestBackup = await findLatestBackup(s3Client, config.s3Bucket, config.s3Prefix);

  if (!latestBackup) {
    logger.warn(`Database is missing and no backups found in s3://${config.s3Bucket}/${config.s3Prefix}/`);
    return;
  }

  logger.info(`Restoring SQLite database from latest S3 backup: key=${latestBackup.key}`);

  try {
    await downloadBackup(s3Client, config.s3Bucket, latestBackup.key, databasePath);
  } catch (error) {
    const tempPath = `${databasePath}.restore-tmp`;
    if (existsSync(tempPath))
      unlinkSync(tempPath);
    throw error;
  }

  const restoredSize = statSync(databasePath).size;
  logger.info(`Restore completed: dbPath=${databasePath}, size=${restoredSize} bytes`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  restoreDatabaseIfNeeded().catch((error) => {
    logger.error(`Restore failed: ${error}`);
    process.exit(1);
  });
}

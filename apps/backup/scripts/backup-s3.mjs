import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { pipeline } from "node:stream/promises";

const ts = () => new Date().toISOString();
const info = (message) => console.log(`[${ts()}] INFO  ${message}`);
const warn = (message) => console.warn(`[${ts()}] WARN  ${message}`);
const error = (message) => console.error(`[${ts()}] ERROR ${message}`);

function toBoolean(value, fallback = false) {
  if (value === undefined)
    return fallback;
  return value.trim().toLowerCase() === "true";
}

function getDatabasePath(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Only SQLite DATABASE_URL with file: is supported, got: ${databaseUrl}`);
  }

  let dbPath = databaseUrl.slice("file:".length);
  if (dbPath.startsWith("//"))
    dbPath = dbPath.replace(/^\/+/, "");

  if (!dbPath.startsWith("/"))
    dbPath = join(process.cwd(), dbPath);

  return dbPath;
}

async function uploadToS3(filePath, s3Client, bucket, prefix) {
  const fileName = basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const key = `${prefix}/${timestamp}-${fileName}`;

  info(`Uploading backup to S3: file=${filePath}, key=${key}`);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: "application/octet-stream",
    ContentLength: statSync(filePath).size,
  }));

  return key;
}

async function cleanupOldBackups(s3Client, bucket, prefix, retentionDays) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let continuationToken;
  let deleted = 0;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${prefix}/`,
      ContinuationToken: continuationToken,
    }));

    for (const item of response.Contents ?? []) {
      if (!item.Key || !item.LastModified)
        continue;

      if (item.LastModified < cutoffDate) {
        info(`Deleting old backup: key=${item.Key}, lastModified=${item.LastModified.toISOString()}`);
        await s3Client.send(new DeleteObjectCommand({
          Bucket: bucket,
          Key: item.Key,
        }));
        deleted += 1;
      }
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

async function run() {
  const backupEnabled = toBoolean(process.env.BACKUP_ENABLED, false);
  if (!backupEnabled) {
    info("Backup is not enabled, skipping");
    return;
  }

  const s3AccessKey = process.env.S3_ACCESS_KEY;
  const s3SecretKey = process.env.S3_SECRET_KEY;
  if (!s3AccessKey || !s3SecretKey) {
    throw new Error("S3_ACCESS_KEY and S3_SECRET_KEY must be configured for backup");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const dbPath = getDatabasePath(databaseUrl);
  if (!existsSync(dbPath)) {
    warn(`Database file does not exist, skipping backup: dbPath=${dbPath}`);
    return;
  }

  const s3Endpoint = process.env.S3_ENDPOINT ?? "https://s3.timeweb.cloud";
  const s3Bucket = process.env.S3_BUCKET ?? "backups";
  const s3Prefix = (process.env.S3_PREFIX ?? "backups").replace(/^\/+|\/+$/g, "");
  const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS ?? "7", 10);

  const backupDir = "/tmp/backups";
  mkdirSync(backupDir, { recursive: true });
  const backupFileName = `spotify-helper-${new Date().toISOString().replace(/[:.]/g, "-")}.db`;
  const backupPath = join(backupDir, backupFileName);

  const sourceStat = statSync(dbPath);
  info(`Copying database file: dbPath=${dbPath}, size=${sourceStat.size}`);
  await pipeline(createReadStream(dbPath), createWriteStream(backupPath));

  const s3Client = new S3Client({
    endpoint: s3Endpoint,
    region: "us-east-1",
    credentials: {
      accessKeyId: s3AccessKey,
      secretAccessKey: s3SecretKey,
    },
    forcePathStyle: true,
  });

  try {
    const key = await uploadToS3(backupPath, s3Client, s3Bucket, s3Prefix);
    info(`Backup uploaded successfully: key=${key}`);

    const deleted = await cleanupOldBackups(s3Client, s3Bucket, s3Prefix, retentionDays);
    info(`Old backups cleanup completed: deletedCount=${deleted}`);
  } finally {
    if (existsSync(backupPath))
      unlinkSync(backupPath);
  }

  info("Backup completed successfully");
}

run().catch((err) => {
  error(`Backup failed: ${err}`);
  process.exit(1);
});

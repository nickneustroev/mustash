import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream, statSync, unlinkSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { loadConfig } from "../core/config.js";
import { logger } from "../core/logger.js";

interface BackupOptions {
  dryRun?: boolean;
}

/**
 * Get database file path from DATABASE_URL
 * Supports: file:./dev.db, file:///app/data/dev.db
 */
function getDatabasePath(): string {
  const config = loadConfig();
  const dbUrl = config.databaseUrl;

  // Handle file: URLs
  let dbPath = dbUrl.replace(/^file:/, "");
  
  // Handle absolute paths starting with ///
  if (dbPath.startsWith("//")) {
    dbPath = dbPath.replace(/^\/+/, "");
  }

  // If relative path, resolve from current working directory
  if (!dbPath.startsWith("/")) {
    dbPath = join(process.cwd(), dbPath);
  }

  return dbPath;
}

/**
 * Upload backup file to S3
 */
async function uploadToS3(filePath: string, s3Client: S3Client, bucket: string, prefix: string): Promise<string> {
  const fileName = basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const s3Key = `${prefix}/${timestamp}-${fileName}`;

  logger.info(`Uploading backup to S3: file=${filePath}, s3Key=${s3Key}`);

  const fileStream = createReadStream(filePath);
  const fileStat = statSync(filePath);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileStream,
    ContentType: "application/octet-stream",
    ContentLength: fileStat.size,
  });

  await s3Client.send(command);

  return s3Key;
}

/**
 * List and delete old backups, keeping only the specified number of days
 */
async function cleanupOldBackups(
  s3Client: S3Client,
  bucket: string,
  prefix: string,
  retentionDays: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  logger.info(`Cleaning up old backups: retentionDays=${retentionDays}, cutoffDate=${cutoffDate.toISOString()}`);

  const listCommand = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${prefix}/`,
  });

  const response = await s3Client.send(listCommand);
  const objects = response.Contents || [];
  let deletedCount = 0;

  for (const obj of objects) {
    if (!obj.Key || !obj.LastModified) continue;

    if (obj.LastModified < cutoffDate) {
      logger.info(`Deleting old backup: key=${obj.Key}, lastModified=${obj.LastModified}`);
      const deleteCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: obj.Key,
      });
      await s3Client.send(deleteCommand);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Create database backup
 */
export async function createBackup(options: BackupOptions = {}): Promise<void> {
  const config = loadConfig();

  if (!config.backupEnabled) {
    logger.info("Backup is not enabled, skipping");
    return;
  }

  if (!config.s3AccessKey || !config.s3SecretKey) {
    throw new Error("S3_ACCESS_KEY and S3_SECRET_KEY must be configured for backup");
  }

  const dbPath = getDatabasePath();
  logger.info(`Starting database backup: dbPath=${dbPath}`);

  // Create temp backup file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = "/tmp/backups";
  
  // Ensure backup directory exists
  const { mkdirSync, existsSync } = await import("node:fs");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const backupFileName = `spotify-helper-${timestamp}.db`;
  const backupPath = join(backupDir, backupFileName);

  if (options.dryRun) {
    logger.info(`DRY RUN: Would copy database: dbPath=${dbPath}, backupPath=${backupPath}`);
  } else {
    // Copy database file
    const sourceStats = statSync(dbPath);
    logger.info(`Copying database file: size=${sourceStats.size}`);
    
    await pipeline(createReadStream(dbPath), createWriteStream(backupPath));
    logger.info(`Database copied successfully: backupPath=${backupPath}`);
  }

  // Initialize S3 client
  const s3Client = new S3Client({
    endpoint: config.s3Endpoint,
    region: "us-east-1", // Default region, required but not used by Timeweb
    credentials: {
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
    },
    forcePathStyle: true, // Required for Timeweb Cloud S3
  });

  // Upload to S3
  if (!options.dryRun) {
    const s3Key = await uploadToS3(backupPath, s3Client, config.s3Bucket, config.s3Prefix);
    logger.info(`Backup uploaded successfully: s3Key=${s3Key}`);

    // Cleanup old backups
    const deletedCount = await cleanupOldBackups(
      s3Client,
      config.s3Bucket,
      config.s3Prefix,
      config.backupRetentionDays
    );
    logger.info(`Old backups cleanup completed: deletedCount=${deletedCount}`);

    // Remove local temp backup
    unlinkSync(backupPath);
    logger.info("Local backup file removed");
  }

  logger.info("Backup completed successfully");
}

// Run if called directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  createBackup().catch((error) => {
    logger.error(`Backup failed: ${error}`);
    process.exit(1);
  });
}

#!/bin/bash
set -e

echo "Starting database backup to S3..."

# Wait for database to be available
if [ -n "$DATABASE_VOLUME_PATH" ]; then
    echo "Using database from volume: $DATABASE_VOLUME_PATH"
fi

# Run the backup
cd /app
node dist/backup-s3.js

echo "Backup completed successfully"
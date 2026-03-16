#!/bin/bash
set -e

echo "Starting database backup to S3..."
NODE_BIN="${NODE_BIN:-/usr/local/bin/node}"
if [ ! -x "$NODE_BIN" ]; then
    NODE_BIN="$(command -v node)"
fi

# Wait for database to be available
if [ -n "$DATABASE_VOLUME_PATH" ]; then
    echo "Using database from volume: $DATABASE_VOLUME_PATH"
fi

# Run the backup
cd /app
"$NODE_BIN" dist/backup-s3.js

echo "Backup completed successfully"

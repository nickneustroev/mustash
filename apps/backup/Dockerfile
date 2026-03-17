FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    cron \
    && rm -rf /var/lib/apt/lists/*

COPY apps/backup/package.json ./package.json
COPY apps/backup/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

COPY apps/backup/scripts/backup-s3.sh ./scripts/backup-s3.sh
COPY apps/backup/scripts/backup-s3.mjs ./scripts/backup-s3.mjs
COPY apps/backup/scripts/start-backup-cron.sh ./scripts/start-backup-cron.sh

CMD ["/bin/bash", "/app/scripts/start-backup-cron.sh"]

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY apps/tracker/src ./apps/tracker/src
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
    cron \
    && rm -rf /var/lib/apt/lists/*

COPY apps/backup/package.json ./package.json
COPY apps/backup/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist/backup-s3.js ./dist/backup-s3.js
COPY --from=builder /app/dist/config.js ./dist/config.js
COPY --from=builder /app/dist/logger.js ./dist/logger.js
COPY apps/backup/scripts/backup-s3.sh ./scripts/backup-s3.sh
COPY apps/backup/scripts/start-backup-cron.sh ./scripts/start-backup-cron.sh

CMD ["/bin/bash", "/app/scripts/start-backup-cron.sh"]

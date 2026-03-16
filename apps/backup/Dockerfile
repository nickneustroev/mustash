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

RUN set -eux; \
    cat > package.json <<'EOF'
{
  "name": "spotify-helper-backup-runtime",
  "private": true,
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.744.0",
    "dotenv": "^17.2.3",
    "zod": "^4.1.12"
  }
}
EOF

RUN npm install --omit=dev --no-package-lock && npm cache clean --force

COPY --from=builder /app/dist/backup-s3.js ./dist/backup-s3.js
COPY --from=builder /app/dist/config.js ./dist/config.js
COPY --from=builder /app/dist/logger.js ./dist/logger.js
COPY apps/backup/scripts/backup-s3.sh ./scripts/backup-s3.sh
COPY apps/backup/scripts/start-backup-cron.sh ./scripts/start-backup-cron.sh

CMD ["/bin/bash", "/app/scripts/start-backup-cron.sh"]

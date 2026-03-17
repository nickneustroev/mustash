FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY apps/tracker/tsconfig.json ./apps/tracker/tsconfig.json
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY apps/tracker/src ./apps/tracker/src

RUN npx prisma generate
RUN npm run build
RUN npm prune --omit=dev && npm cache clean --force
RUN npm install --no-save prisma@7.5.0 && npm cache clean --force
RUN npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > /dev/null

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Prisma engines require OpenSSL in slim images.
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/apps/tracker/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /root/.cache/prisma /root/.cache/prisma

EXPOSE 3000

CMD ["sh", "-c", "node dist/backup/restore-s3.js && npx prisma migrate deploy && node dist/core/main.js"]

FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY packages/db ./packages/db
COPY packages/spotify ./packages/spotify
RUN npm ci

COPY apps/auto-playlists/tsconfig.json ./apps/auto-playlists/tsconfig.json
COPY apps/auto-playlists/src ./apps/auto-playlists/src

RUN npm run build:auto-playlists
RUN npm prune --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/auto-playlists/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/core/main.js"]

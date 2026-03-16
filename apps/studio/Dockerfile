FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/studio/package.json ./package.json
COPY apps/studio/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

EXPOSE 5555

CMD ["npx", "prisma", "studio", "--port", "5555", "--browser", "none"]

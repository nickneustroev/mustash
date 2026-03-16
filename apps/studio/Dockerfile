FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    cat > package.json <<'EOF'
{
  "name": "spotify-helper-prisma-studio-runtime",
  "private": true,
  "dependencies": {
    "@prisma/client": "^7.5.0",
    "prisma": "^7.5.0"
  }
}
EOF

RUN npm install --omit=dev --no-package-lock && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npx prisma generate

EXPOSE 5555

CMD ["npx", "prisma", "studio", "--port", "5555", "--browser", "none"]

import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

loadEnv({ path: path.resolve(process.cwd(), ".env.auto-playlists") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/spotify_helper",
  },
});

import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

loadEnv({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});

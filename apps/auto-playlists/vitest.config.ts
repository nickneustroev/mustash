import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/auto-playlists/test/**/*.test.ts"],
  },
});

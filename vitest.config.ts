import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/tracker/test/**/*.test.ts"],
  },
});

import path from "node:path";
import { defineConfig } from "vitest/config";

/** SEC-01..10 (REQUIREMENTS.md 9.4.4). Run with `npm run test:security`. */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
  test: {
    include: ["tests/security/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});

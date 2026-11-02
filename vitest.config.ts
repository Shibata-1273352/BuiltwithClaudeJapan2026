import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/web/src/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});

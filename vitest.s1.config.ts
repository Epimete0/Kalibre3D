import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: { include: ["tests/security-definer-private-schema.integration.test.ts"], testTimeout: 60_000, hookTimeout: 60_000 },
});

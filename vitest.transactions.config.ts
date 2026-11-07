import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd(), "src") } },
  test: {
    include: [
      "tests/center-creation.integration.test.ts",
      "tests/team.integration.test.ts",
      "tests/phase1-integrity.integration.test.ts",
      "tests/center-settings.integration.test.ts",
      "tests/products.integration.test.ts",
      "tests/customers.integration.test.ts",
      "tests/orders-creation.integration.test.ts",
      "tests/orders-status.integration.test.ts",
    ],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});

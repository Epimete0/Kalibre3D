import { spawnSync } from "node:child_process";
import { createLocalPostgresEnvironment } from "./local-postgres";

let environment: ReturnType<typeof createLocalPostgresEnvironment>;
try {
  environment = createLocalPostgresEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : "QUALITY_GATE_REMOTE_DATABASE_BLOCKED");
  process.exit(1);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["vitest", "run", "--config", "vitest.s3.config.ts"], {
  env: { ...environment.childEnv, RUN_S3_INTEGRATION: "1" },
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);

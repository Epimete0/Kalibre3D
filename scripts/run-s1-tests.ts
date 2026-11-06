import { spawnSync } from "node:child_process";
import { createLocalPostgresEnvironment } from "./local-postgres";

let environment: ReturnType<typeof createLocalPostgresEnvironment>;
try {
  environment = createLocalPostgresEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : "QUALITY_GATE_REMOTE_DATABASE_BLOCKED");
  process.exit(1);
}
const result = spawnSync("npx", ["vitest", "run", "--config", "vitest.s1.config.ts", ...process.argv.slice(2)], { env: { ...environment.childEnv, RUN_S1_INTEGRATION: "1" }, stdio: "inherit", shell: true });
process.exit(result.status ?? 1);

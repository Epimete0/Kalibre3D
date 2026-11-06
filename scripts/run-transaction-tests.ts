import { spawnSync } from "node:child_process";
import { createLocalPostgresEnvironment } from "./local-postgres";

let localEnvironment: ReturnType<typeof createLocalPostgresEnvironment>;
try {
  localEnvironment = createLocalPostgresEnvironment();
} catch (error) {
  console.error(error instanceof Error ? error.message : "QUALITY_GATE_REMOTE_DATABASE_BLOCKED");
  process.exit(1);
}
const result = spawnSync("npx", ["vitest", "run", "--config", "vitest.transactions.config.ts", ...process.argv.slice(2)], { env: { ...localEnvironment.childEnv, RUN_TRANSACTION_INTEGRATION: "1" }, stdio: "inherit", shell: true });
process.exit(result.status ?? 1);

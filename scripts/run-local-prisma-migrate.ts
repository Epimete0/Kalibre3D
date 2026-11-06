import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createLocalPostgresEnvironment, LocalPostgresEnvironmentError } from "./local-postgres";

export function runLocalPrismaMigrate(
  environment: Parameters<typeof createLocalPostgresEnvironment>[0] = process.env,
  getStatus?: Parameters<typeof createLocalPostgresEnvironment>[1],
) {
  const local = createLocalPostgresEnvironment(environment, getStatus);
  const result = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
    env: local.childEnv,
    stdio: "inherit",
    shell: false,
  });
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = runLocalPrismaMigrate();
  } catch (error) {
    console.error(error instanceof LocalPostgresEnvironmentError
      ? error.message
      : "No fue posible ejecutar las migraciones locales. Intenta nuevamente.");
    process.exitCode = 1;
  }
}

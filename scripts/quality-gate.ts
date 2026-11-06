// Quality gate de saas3d (adaptado del de Kurova, solo lectura). Comando único de cierre de una iteración:
// unitarias, lint, build, estado de migraciones y pruebas reales contra la instancia local saas3d-test.
import { spawnSync } from "node:child_process";
import {
  createLocalPostgresEnvironment,
  formatPostgresTarget,
  isLocalEnvironmentUnavailable,
  withoutPostgresEnvironment,
} from "./local-postgres";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

let failed = false;
let incomplete = false;

function run(label: string, command: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`\n[quality:gate] ${label}`);
  const result = spawnSync(command, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (result.status !== 0) {
    failed = true;
    console.error(`[quality:gate] FAILED: ${label}`);
  }
}

let localEnvironment: ReturnType<typeof createLocalPostgresEnvironment> | undefined;
let localEnvironmentUnavailable = false;
try {
  localEnvironment = createLocalPostgresEnvironment();
  console.log(`\n[quality:gate] PostgreSQL test target: ${formatPostgresTarget(localEnvironment.databaseUrl)}`);
} catch (error) {
  incomplete = true;
  localEnvironmentUnavailable = isLocalEnvironmentUnavailable(error);
  console.error(`\n[quality:gate] ${error instanceof Error ? error.message : "QUALITY_GATE_PARTIAL_LOCAL_ENVIRONMENT: No fue posible validar Supabase local."}`);
}

const executionEnvironment = localEnvironment?.childEnv ?? withoutPostgresEnvironment();
run("unit and component tests", npmCommand, ["test"], executionEnvironment);
run("lint", npmCommand, ["run", "lint"], executionEnvironment);
run("production build", npmCommand, ["run", "build"], executionEnvironment);

if (localEnvironment) {
  // Las suites reales reinician el schema public de saas3d-test: primero se aplica y verifica el historial.
  run("Prisma migrate deploy (saas3d-test)", npmCommand, ["run", "prisma:migrate"], process.env);
  run("Prisma migration status", npxCommand, ["prisma", "migrate", "status"], localEnvironment.childEnv);
  run("real RLS integration tests", npmCommand, ["run", "test:rls"], localEnvironment.childEnv);
  run("real S1 security integration tests", npmCommand, ["run", "test:s1"], localEnvironment.childEnv);
  run("real S3 Prisma migration ACL integration tests", npmCommand, ["run", "test:s3"], localEnvironment.childEnv);
  run("real transaction integration tests", npmCommand, ["run", "test:transactions"], localEnvironment.childEnv);
} else {
  console.error(localEnvironmentUnavailable
    ? "\n[quality:gate] INCOMPLETE: Docker Desktop o Supabase local no está disponible. Se omitieron Prisma y las pruebas PostgreSQL reales."
    : "\n[quality:gate] BLOCKED: Se omitieron Prisma y las pruebas PostgreSQL reales para impedir acceso a una base remota.");
}

if (failed || incomplete) {
  console.error("\n[quality:gate] NOT PASSED: resolve failures and execute all real database tests before closing the task.");
  process.exitCode = 1;
} else {
  console.log("\n[quality:gate] PASSED: all checks completed.");
}

// Aplica las migraciones en la instancia de DESARROLLO saas3d-local (supabase-local/, puertos 5444x).
// La instancia de pruebas saas3d-test la gestionan prisma:migrate y quality:gate. Solo acepta loopback.
import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { assertLoopbackPostgresUrl } from "./local-postgres";

function readDevStatus(): Record<string, string> {
  const output = execSync("npx supabase status -o env --workdir supabase-local", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line);
    return match ? [[match[1], match[2]]] : [];
  }));
}

let databaseUrl: string;
try {
  databaseUrl = readDevStatus().DB_URL ?? "";
  assertLoopbackPostgresUrl(databaseUrl);
} catch {
  console.error("No fue posible leer la instancia saas3d-local. Iníciala con: npx supabase start --workdir supabase-local");
  process.exit(1);
}

const result = spawnSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);

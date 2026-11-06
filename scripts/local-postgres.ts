import { execFileSync } from "node:child_process";

export const LOCAL_POSTGRES_BLOCKED = "QUALITY_GATE_REMOTE_DATABASE_BLOCKED";
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

type LocalSupabaseEnvironment = Record<string, string>;
type Environment = Record<string, string | undefined>;

export class LocalPostgresEnvironmentError extends Error {
  constructor(
    readonly code: typeof LOCAL_POSTGRES_BLOCKED | "QUALITY_GATE_LOCAL_DATABASE_UNAVAILABLE",
    message: string,
  ) {
    super(message);
  }
}

function isLoopbackUrl(url: URL) {
  return loopbackHosts.has(url.hostname.replace(/^\[|\]$/g, "").toLowerCase());
}

export function assertLoopbackPostgresUrl(databaseUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new LocalPostgresEnvironmentError(
      LOCAL_POSTGRES_BLOCKED,
      `${LOCAL_POSTGRES_BLOCKED}: La URL de PostgreSQL debe usar un host loopback.`,
    );
  }

  if (!(["postgresql:", "postgres:"] as const).includes(parsed.protocol as "postgresql:" | "postgres:") || !isLoopbackUrl(parsed)) {
    throw new LocalPostgresEnvironmentError(
      LOCAL_POSTGRES_BLOCKED,
      `${LOCAL_POSTGRES_BLOCKED}: La URL de PostgreSQL debe usar un host loopback.`,
    );
  }

  return parsed;
}

function assertLoopbackApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && isLoopbackUrl(parsed)) return;
  } catch {
    // Fall through to the safe error below.
  }

  throw new LocalPostgresEnvironmentError(
    LOCAL_POSTGRES_BLOCKED,
    `${LOCAL_POSTGRES_BLOCKED}: La URL de Supabase debe usar un host loopback.`,
  );
}

function parseSupabaseStatusEnvironment(output: string): LocalSupabaseEnvironment {
  return Object.fromEntries(output.split(/\r?\n/).flatMap((line) => {
    const match = /^([A-Z_]+)="(.*)"$/.exec(line);
    return match ? [[match[1], match[2]]] : [];
  }));
}

function readLocalSupabaseStatus(): LocalSupabaseEnvironment {
  try {
    const command = process.platform === "win32" ? ".\\node_modules\\.bin\\supabase.cmd" : "node_modules/.bin/supabase";
    return parseSupabaseStatusEnvironment(execFileSync(command, ["status", "-o", "env"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    }));
  } catch {
    throw new LocalPostgresEnvironmentError(
      "QUALITY_GATE_LOCAL_DATABASE_UNAVAILABLE",
      "QUALITY_GATE_PARTIAL_LOCAL_ENVIRONMENT: Docker Desktop o Supabase local no está disponible.",
    );
  }
}

function validateConfiguredDatabaseUrls(environment: Environment) {
  for (const name of ["DATABASE_URL", "DIRECT_URL", "SUPABASE_TEST_DATABASE_URL"] as const) {
    const databaseUrl = environment[name];
    if (databaseUrl) assertLoopbackPostgresUrl(databaseUrl);
  }
}

export function formatPostgresTarget(databaseUrl: string) {
  const parsed = assertLoopbackPostgresUrl(databaseUrl);
  return `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}`;
}

export function createLocalPostgresEnvironment(
  environment: Environment = process.env,
  getStatus: () => LocalSupabaseEnvironment = readLocalSupabaseStatus,
) {
  validateConfiguredDatabaseUrls(environment);

  const local = getStatus();
  const databaseUrl = local.DB_URL;
  const apiUrl = local.API_URL;
  if (!databaseUrl || !apiUrl || !local.PUBLISHABLE_KEY || !local.SERVICE_ROLE_KEY) {
    throw new LocalPostgresEnvironmentError(
      "QUALITY_GATE_LOCAL_DATABASE_UNAVAILABLE",
      "QUALITY_GATE_PARTIAL_LOCAL_ENVIRONMENT: Supabase local no devolvió el entorno de pruebas completo.",
    );
  }

  assertLoopbackPostgresUrl(databaseUrl);
  assertLoopbackApiUrl(apiUrl);

  return {
    databaseUrl,
    apiUrl,
    childEnv: {
      ...environment,
      NODE_ENV: environment.NODE_ENV ?? "",
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      SUPABASE_TEST_DATABASE_URL: databaseUrl,
      SUPABASE_TEST_URL: apiUrl,
      SUPABASE_TEST_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY,
      SUPABASE_TEST_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    } as NodeJS.ProcessEnv,
  };
}

export function withoutPostgresEnvironment(environment: Environment = process.env) {
  return {
    ...environment,
    NODE_ENV: environment.NODE_ENV ?? "",
    DATABASE_URL: "",
    DIRECT_URL: "",
    SUPABASE_TEST_DATABASE_URL: "",
  } as NodeJS.ProcessEnv;
}

export function isLocalEnvironmentUnavailable(error: unknown) {
  return error instanceof LocalPostgresEnvironmentError && error.code === "QUALITY_GATE_LOCAL_DATABASE_UNAVAILABLE";
}

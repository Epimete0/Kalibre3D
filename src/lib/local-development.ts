import type { PoolConfig } from "pg";
import { createPostgresTlsConfig } from "./postgres-tls";

type Environment = Record<string, string | undefined>;
const loopback = new Set(["127.0.0.1", "localhost", "::1"]);
export function assertLocalUrl(value: string, database = false) {
  try {
    const url = new URL(value);
    const protocols = database ? ["postgres:", "postgresql:"] : ["http:", "https:"];
    if (protocols.includes(url.protocol) && loopback.has(url.hostname.replace(/^\[|\]$/g, "").toLowerCase())) return;
  } catch { /* Fail closed without echoing credentials. */ }
  throw new Error("LOCAL_DEMO_BOOTSTRAP=REFUSED_NON_LOOPBACK");
}

export function assertLocalEndpoints(env: Environment) {
  for (const key of ["DATABASE_URL", "DIRECT_URL", "SUPABASE_TEST_DATABASE_URL"]) {
    if (env[key] !== undefined) assertLocalUrl(env[key]!, true);
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "SUPABASE_TEST_URL", "NEXT_PUBLIC_SITE_URL"]) {
    if (env[key] !== undefined) assertLocalUrl(env[key]!);
  }
}

export function assertLocalDevelopment(env: Environment) {
  if (env.NODE_ENV === "production") throw new Error("LOCAL_DEMO_BOOTSTRAP=REFUSED_PRODUCTION");
  assertLocalEndpoints(env);
  if (env.NODE_ENV !== "development" || env.SAAS3D_LOCAL_DEV !== "YES") throw new Error("LOCAL_DEMO_BOOTSTRAP=REFUSED_NO_OPT_IN");
  assertLocalUrl(env.DATABASE_URL ?? "", true);
  assertLocalUrl(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}

function isLoopbackPostgresUrl(value: string) {
  try {
    assertLocalUrl(value, true);
    return true;
  } catch {
    return false;
  }
}

function createLocalPostgresConfig(connectionString: string): Pick<PoolConfig, "connectionString" | "ssl"> {
  const url = new URL(connectionString);
  if ([...url.searchParams.keys()].some((key) => key.startsWith("ssl"))) throw new Error("LOCAL_DEMO_BOOTSTRAP=REFUSED_TLS_OVERRIDE");
  return { connectionString, ssl: false };
}

export function createRuntimePostgresConfig(connectionString: string, env: Environment = process.env): Pick<PoolConfig, "connectionString" | "ssl"> {
  const loopbackConnection = isLoopbackPostgresUrl(connectionString);

  if (loopbackConnection && env.NODE_ENV !== "production") {
    if (env.SAAS3D_LOCAL_DEV === "YES") assertLocalDevelopment(env);
    return createLocalPostgresConfig(connectionString);
  }

  if (env.SAAS3D_LOCAL_DEV === "YES") {
    assertLocalDevelopment(env);
    assertLocalUrl(connectionString, true);
    return createLocalPostgresConfig(connectionString);
  }

  return createPostgresTlsConfig(connectionString);
}

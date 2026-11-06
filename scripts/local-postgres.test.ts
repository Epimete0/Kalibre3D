import { describe, expect, it } from "vitest";
import {
  LOCAL_POSTGRES_BLOCKED,
  assertLoopbackPostgresUrl,
  createLocalPostgresEnvironment,
  formatPostgresTarget,
} from "./local-postgres";

const localDatabaseUrl = "postgresql://postgres:local-password@127.0.0.1:54322/postgres";

describe("local PostgreSQL harness guard", () => {
  it.each([
    ["postgresql://postgres:password@127.0.0.1:54322/postgres"],
    ["postgresql://postgres:password@localhost:54322/postgres"],
    ["postgresql://postgres:password@[::1]:54322/postgres"],
  ])("allows loopback URL %s", (databaseUrl) => {
    expect(assertLoopbackPostgresUrl(databaseUrl)).toBeInstanceOf(URL);
  });

  it.each([
    ["postgresql://postgres:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres"],
    ["postgresql://postgres:password@db.example.supabase.co:5432/postgres"],
    ["postgresql://postgres:password@database.example.test:5432/postgres"],
    ["not a database URL"],
  ])("blocks remote or invalid URL without revealing its password", (databaseUrl) => {
    expect(() => assertLoopbackPostgresUrl(databaseUrl)).toThrow(LOCAL_POSTGRES_BLOCKED);
    expect(() => assertLoopbackPostgresUrl(databaseUrl)).not.toThrow("password");
  });

  it("blocks a fictitious remote process environment before reading local status", () => {
    expect(() => createLocalPostgresEnvironment(
      { DATABASE_URL: "postgresql://postgres:fictitious-password@remote.example.test:5432/postgres" },
      () => {
        throw new Error("Local status must not be read for a blocked target.");
      },
    )).toThrow(LOCAL_POSTGRES_BLOCKED);
  });

  it("overrides all PostgreSQL variables with the canonical local target", () => {
    const environment = createLocalPostgresEnvironment(
      { DATABASE_URL: localDatabaseUrl, DIRECT_URL: localDatabaseUrl, SUPABASE_TEST_DATABASE_URL: localDatabaseUrl },
      () => ({
        API_URL: "http://127.0.0.1:54321",
        DB_URL: localDatabaseUrl,
        PUBLISHABLE_KEY: "local-publishable-key",
        SERVICE_ROLE_KEY: "local-service-role-key",
      }),
    );

    expect(environment.databaseUrl).toBe(localDatabaseUrl);
    expect(environment.childEnv).toMatchObject({
      DATABASE_URL: localDatabaseUrl,
      DIRECT_URL: localDatabaseUrl,
      SUPABASE_TEST_DATABASE_URL: localDatabaseUrl,
    });
    expect(formatPostgresTarget(localDatabaseUrl)).toBe("127.0.0.1:54322/postgres");
  });
});

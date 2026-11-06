import { afterEach, describe, expect, it, vi } from "vitest";
import { assertLocalDevelopment, assertLocalEndpoints, createRuntimePostgresConfig } from "./local-development";

const local = { NODE_ENV: "development", SAAS3D_LOCAL_DEV: "YES", DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
afterEach(() => vi.unstubAllEnvs());
describe("local development transport", () => {
  it("allows local with explicit opt-in", () => {
    expect(createRuntimePostgresConfig(local.DATABASE_URL, local)).toEqual({ connectionString: local.DATABASE_URL, ssl: false });
  });
  it.each(["127.0.0.1", "localhost", "[::1]"])("allows loopback %s", (host) => {
    expect(() => assertLocalDevelopment({ ...local, DATABASE_URL: `postgresql://postgres@${host}/postgres`, NEXT_PUBLIC_SUPABASE_URL: `http://${host}:54321` })).not.toThrow();
  });
  it.each(["127.0.0.1", "localhost", "[::1]"])("allows loopback PostgreSQL without CA or opt-in for %s", (host) => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    const databaseUrl = `postgresql://postgres:postgres@${host}:54322/postgres`;
    expect(createRuntimePostgresConfig(databaseUrl, {
      NODE_ENV: "development",
      SAAS3D_LOCAL_DEV: undefined,
      DATABASE_URL: databaseUrl,
      NEXT_PUBLIC_SUPABASE_URL: `http://${host}:54321`,
    })).toEqual({ connectionString: databaseUrl, ssl: false });
  });

  it("keeps the CA requirement for remote PostgreSQL without opt-in", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    expect(() => createRuntimePostgresConfig("postgresql://user:password@pooler.example.com:6543/postgres", { NODE_ENV: "development" })).toThrow("SUPABASE_DB_CA_CERT");
  });
  it("keeps the CA requirement for loopback PostgreSQL in production", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    expect(() => createRuntimePostgresConfig("postgresql://user:password@127.0.0.1:54322/postgres", { NODE_ENV: "production" })).toThrow("SUPABASE_DB_CA_CERT");
  });
  it("strict mode retains certificate verification", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", "test-ca");
    expect(createRuntimePostgresConfig("postgresql://user:password@pooler.example.com:6543/postgres", {}).ssl).toEqual({ ca: "test-ca", rejectUnauthorized: true });
  });
  it("refuses production even with opt-in", () => {
    expect(() => assertLocalDevelopment({ ...local, NODE_ENV: "production" })).toThrow("REFUSED_PRODUCTION");
  });
  it.each(["DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "DIRECT_URL", "SUPABASE_TEST_URL", "SUPABASE_TEST_DATABASE_URL"])("refuses remote %s", (key) => {
    expect(() => assertLocalEndpoints({ ...local, [key]: "https://remote.example.test" })).toThrow("REFUSED_NON_LOOPBACK");
  });
  it("checks actual runtime connection as well as environment", () => {
    expect(() => createRuntimePostgresConfig("postgresql://remote.example.test/db", local)).toThrow("REFUSED_NON_LOOPBACK");
  });
  it.each(["http://localhost.evil.test", "http://localhost@evil.test", "garbage", "file://localhost/path"])("rejects misleading URL %s", (url) => {
    expect(() => assertLocalDevelopment({ ...local, NEXT_PUBLIC_SUPABASE_URL: url })).toThrow("REFUSED_NON_LOOPBACK");
  });
  it("refuses missing endpoint or opt-in", () => {
    expect(() => assertLocalDevelopment({ ...local, DATABASE_URL: undefined })).toThrow();
    expect(() => assertLocalDevelopment({ ...local, SAAS3D_LOCAL_DEV: undefined })).toThrow();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createPostgresTlsConfig } from "./postgres-tls";

const connectionString = "postgresql://user:password@pooler.example.com:6543/postgres";
const certificateAuthority = "-----BEGIN CERTIFICATE-----\ntest-ca\n-----END CERTIFICATE-----";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPostgresTlsConfig", () => {
  it("requires the server-only certificate authority and enables certificate validation", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", certificateAuthority);

    const config = createPostgresTlsConfig(connectionString);

    expect(config).toEqual({
      connectionString,
      ssl: {
        ca: certificateAuthority,
        rejectUnauthorized: true,
      },
    });
    expect(config.ssl).not.toHaveProperty("checkServerIdentity");
  });

  it("fails without leaking connection details when the certificate authority is absent", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    const sensitiveConnectionString = "postgresql://user:secret-password@pooler.example.com:6543/postgres";

    let error: unknown;
    try {
      createPostgresTlsConfig(sensitiveConnectionString);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("SUPABASE_DB_CA_CERT");
    expect((error as Error).message).not.toContain("secret-password");
  });

  it.each(["ssl", "sslcert", "sslkey", "sslrootcert"])("rejects the %s connection parameter because it overrides the TLS object", (parameter) => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", certificateAuthority);
    const url = new URL(connectionString);
    url.searchParams.set(parameter, "value");

    expect(() => createPostgresTlsConfig(url.toString())).toThrow("parámetro TLS incompatible");
  });

  it("normalizes exactly one sslmode=verify-full before pg can replace the TLS object", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", certificateAuthority);
    const url = new URL(connectionString);
    url.searchParams.append("sslmode", "verify-full");

    const config = createPostgresTlsConfig(url.toString());

    expect(config.connectionString).toBeDefined();
    expect(new URL(config.connectionString!).searchParams.has("sslmode")).toBe(false);
    expect(config.ssl).toEqual({ ca: certificateAuthority, rejectUnauthorized: true });
  });

  it("rejects duplicate TLS parameters", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", certificateAuthority);
    const url = new URL(connectionString);
    url.searchParams.append("sslmode", "verify-full");
    url.searchParams.append("sslmode", "disable");

    expect(() => createPostgresTlsConfig(url.toString())).toThrow("parámetro TLS incompatible");
  });

  it("fails safely for an invalid connection string", () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", certificateAuthority);

    expect(() => createPostgresTlsConfig("not a URL")).toThrow("La configuración TLS de PostgreSQL no es válida.");
  });
});

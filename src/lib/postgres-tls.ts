import { env } from "node:process";
import type { PoolConfig } from "pg";

const TLS_OVERRIDE_PARAMETERS = ["ssl", "sslcert", "sslkey", "sslrootcert"] as const;

export function createPostgresTlsConfig(connectionString: string): Pick<PoolConfig, "connectionString" | "ssl"> {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("La configuración TLS de PostgreSQL no es válida.");
  }

  const sslModes = url.searchParams.getAll("sslmode");
  if (sslModes.length > 0 && (sslModes.length !== 1 || sslModes[0] !== "verify-full")) {
    throw new Error("La configuración TLS de PostgreSQL contiene un parámetro TLS incompatible.");
  }
  if (TLS_OVERRIDE_PARAMETERS.some((parameter) => url.searchParams.has(parameter))) {
    throw new Error("La configuración TLS de PostgreSQL contiene un parámetro TLS incompatible.");
  }
  url.searchParams.delete("sslmode");

  const certificateAuthority = env.SUPABASE_DB_CA_CERT;
  if (!certificateAuthority) throw new Error("SUPABASE_DB_CA_CERT es obligatoria para conectar con PostgreSQL.");

  return {
    connectionString: url.toString(),
    ssl: {
      ca: certificateAuthority,
      rejectUnauthorized: true,
    },
  };
}

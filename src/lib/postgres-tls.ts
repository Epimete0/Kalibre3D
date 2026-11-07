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
  if (sslModes.length > 1) {
    throw new Error("La configuración TLS de PostgreSQL contiene un parámetro TLS incompatible.");
  }
  const mode = sslModes[0];
  if (mode && !["verify-full", "require", "verify-ca", "prefer"].includes(mode)) {
    throw new Error("La configuración TLS de PostgreSQL contiene un parámetro TLS incompatible.");
  }
  if (TLS_OVERRIDE_PARAMETERS.some((parameter) => url.searchParams.has(parameter))) {
    throw new Error("La configuración TLS de PostgreSQL contiene un parámetro TLS incompatible.");
  }
  url.searchParams.delete("sslmode");

  const certificateAuthority = env.SUPABASE_DB_CA_CERT;
  if (certificateAuthority) {
    return {
      connectionString: url.toString(),
      ssl: {
        ca: certificateAuthority,
        rejectUnauthorized: true,
      },
    };
  }

  // Si no se proporcionó SUPABASE_DB_CA_CERT:
  // - En modo "verify-full" explícito o conexión sin sslmode, se exige el certificado CA.
  // - En modo "require" (generado por Supabase/Vercel), se conecta con TLS sin exigir CA local.
  if (mode === "verify-full" || !mode) {
    throw new Error("SUPABASE_DB_CA_CERT es obligatoria para conectar con PostgreSQL.");
  }

  return {
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: false,
    },
  };
}

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash } from "node:crypto";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { createPostgresTlsConfig } from "./postgres-tls";

export function normalizeC4C2ApplicationName(value: string) {
  const ascii = value.replace(/[^\x20-\x7E]/g, "_");
  if (Buffer.byteLength(ascii, "utf8") <= 63) return ascii;
  const suffix = createHash("sha256").update(ascii).digest("hex").slice(0, 16);
  return `${ascii.slice(0, 46)}_${suffix}`;
}

export async function configureApplicationName(client: Pick<PoolClient, "query">, applicationName: string) {
  const normalized = normalizeC4C2ApplicationName(applicationName);
  const result = await client.query<{ application_name_ok: boolean }>(
    "SELECT set_config('application_name', $1, false) = $1 AS application_name_ok",
    [normalized],
  );
  if (result.rows[0]?.application_name_ok !== true) throw new Error("El preflight C4C2 no pudo configurar application_name.");
}

export class ApplicationNamedPool extends Pool {
  readonly c4c2ApplicationName: string;

  constructor(config: PoolConfig, applicationName: string) {
    const normalized = normalizeC4C2ApplicationName(applicationName);
    super({ ...config, application_name: normalized });
    this.c4c2ApplicationName = normalized;
  }

  override connect(): Promise<PoolClient>;
  override connect(callback: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void): void;
  override connect(callback?: (err: Error | undefined, client: PoolClient | undefined, done: (release?: unknown) => void) => void) {
    if (callback) {
      super.connect((error, client, done) => {
        if (error || !client) return callback(error, client, done);
        void configureApplicationName(client, this.c4c2ApplicationName).then(
          () => callback(undefined, client, done),
          (configurationError: Error) => {
            client.release(true);
            callback(configurationError, undefined, () => undefined);
          },
        );
      });
      return;
    }
    return super.connect().then(async (client) => {
      try {
        await configureApplicationName(client, this.c4c2ApplicationName);
        return client;
      } catch (error) {
        client.release(true);
        throw error;
      }
    });
  }
}

export type IsolatedPrismaHandle = {
  prisma: PrismaClient;
  pool: Pool;
  applicationName: string;
  disconnect(): Promise<void>;
};

export function createIsolatedPrismaHandle({ connectionString, applicationName }: { connectionString: string; applicationName: string }): IsolatedPrismaHandle {
  const normalized = normalizeC4C2ApplicationName(applicationName);
  const pool = new ApplicationNamedPool(createPostgresTlsConfig(connectionString), normalized);
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  let disconnected = false;
  return {
    prisma,
    pool,
    applicationName: normalized,
    async disconnect() {
      if (disconnected) return;
      disconnected = true;
      await prisma.$disconnect();
      await pool.end();
    },
  };
}

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRuntimePostgresConfig } from "./local-development";

// Reuse a single PrismaClient across hot reloads in development to
// avoid exhausting database connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaClient = globalForPrisma.prisma;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL es obligatoria para conectar con Supabase");
  const adapter = new PrismaPg(createRuntimePostgresConfig(connectionString));

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export function getPrisma() {
  if (prismaClient) return prismaClient;

  prismaClient = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaClient;
  }

  return prismaClient;
}

// Keep existing imports lazy while preserving PrismaClient's public API.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrisma();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, property, value) {
    return Reflect.set(getPrisma(), property, value);
  },
  has(_target, property) {
    return Reflect.has(getPrisma(), property);
  },
  ownKeys() {
    return Reflect.ownKeys(getPrisma());
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getPrisma(), property);
    return descriptor ? { ...descriptor, configurable: true } : undefined;
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getPrisma());
  },
  deleteProperty(_target, property) {
    return Reflect.deleteProperty(getPrisma(), property);
  },
});

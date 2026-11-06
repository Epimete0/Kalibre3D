import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PrismaClientMock, PrismaPgMock } = vi.hoisted(() => ({
  PrismaClientMock: vi.fn(),
  PrismaPgMock: vi.fn(),
}));

vi.mock("@/generated/prisma/client", () => ({ PrismaClient: PrismaClientMock }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: PrismaPgMock }));

const globalForPrisma = globalThis as typeof globalThis & { prisma?: unknown };

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  delete globalForPrisma.prisma;
  PrismaClientMock.mockImplementation(function PrismaClient() { return {}; });
  PrismaPgMock.mockImplementation(function PrismaPg() { return {}; });
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete globalForPrisma.prisma;
});

describe("prisma lazy singleton", () => {
  it("imports without constructing Prisma when the certificate authority is absent", async () => {
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    await expect(import("./prisma")).resolves.toBeDefined();

    expect(PrismaClientMock).not.toHaveBeenCalled();
    expect(PrismaPgMock).not.toHaveBeenCalled();
  });

  it("fails safely on first Prisma access when the certificate authority is absent", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@pooler.example.com:6543/postgres");
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    const { prisma } = await import("./prisma");

    expect(() => prisma.$connect).toThrow("SUPABASE_DB_CA_CERT es obligatoria");
    expect(PrismaClientMock).not.toHaveBeenCalled();
  });

  it("constructs Prisma for a local loopback database without a CA", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@127.0.0.1:54322/postgres");
    vi.stubEnv("SUPABASE_DB_CA_CERT", "");
    const { prisma } = await import("./prisma");

    void prisma.$connect;

    expect(PrismaPgMock).toHaveBeenCalledWith({
      connectionString: "postgresql://user:password@127.0.0.1:54322/postgres",
      ssl: false,
    });
    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("constructs Prisma with the certificate authority on first access", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@pooler.example.com:6543/postgres");
    vi.stubEnv("SUPABASE_DB_CA_CERT", "test-ca");
    const { prisma } = await import("./prisma");

    void prisma.$connect;

    expect(PrismaPgMock).toHaveBeenCalledWith({
      connectionString: "postgresql://user:password@pooler.example.com:6543/postgres",
      ssl: { ca: "test-ca", rejectUnauthorized: true },
    });
    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
  });

  it("reuses one client and adapter across module reloads in development", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@pooler.example.com:6543/postgres");
    vi.stubEnv("SUPABASE_DB_CA_CERT", "test-ca");
    const first = await import("./prisma");

    void first.prisma.$connect;
    vi.resetModules();
    const second = await import("./prisma");
    void second.prisma.$disconnect;

    expect(PrismaClientMock).toHaveBeenCalledTimes(1);
    expect(PrismaPgMock).toHaveBeenCalledTimes(1);
  });

  it("forwards Prisma methods and membership checks to the lazy client", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@pooler.example.com:6543/postgres");
    vi.stubEnv("SUPABASE_DB_CA_CERT", "test-ca");
    const client = { $connect: vi.fn(function (this: unknown) { return this; }) };
    PrismaClientMock.mockImplementation(function PrismaClient() { return client; });
    const { prisma } = await import("./prisma");

    expect("$connect" in prisma).toBe(true);
    expect(prisma.$connect()).toBe(client);
  });
});

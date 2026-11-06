import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { poolEnd, disconnect, adapterOperation, checkoutQuery, checkoutRelease, poolConfigs, prismaOptions, PoolMockClass, PrismaPgMock, PrismaClientMock } = vi.hoisted(() => {
  const poolEnd = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn().mockResolvedValue(undefined);
  const adapterOperation = vi.fn();
  const checkoutQuery = vi.fn().mockResolvedValue({ rows: [{ application_name_ok: true }] });
  const checkoutRelease = vi.fn();
  const poolConfigs: unknown[] = [];
  const prismaOptions: unknown[] = [];
  class PoolMockClass {
    options;
    end = poolEnd;
    constructor(options: unknown) { this.options = options; poolConfigs.push(options); }
    connect() { return Promise.resolve({ query: checkoutQuery, release: checkoutRelease }); }
  }
  class PrismaPgMockClass { pool; constructor(pool: unknown) { this.pool = pool; } }
  const PrismaPgMock = vi.fn(PrismaPgMockClass);
  class PrismaClientMockClass {
    adapter;
    $disconnect = disconnect;
    $queryRaw = adapterOperation;
    constructor(options: { adapter: unknown }) { this.adapter = options.adapter; prismaOptions.push(options); }
  }
  const PrismaClientMock = vi.fn(PrismaClientMockClass);
  return { poolEnd, disconnect, adapterOperation, checkoutQuery, checkoutRelease, poolConfigs, prismaOptions, PoolMockClass, PrismaPgMock, PrismaClientMock };
});
vi.mock("pg", () => ({ Pool: PoolMockClass }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: PrismaPgMock }));
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: PrismaClientMock }));

import { configureApplicationName, createIsolatedPrismaHandle, normalizeC4C2ApplicationName } from "./prisma-client-factory";

beforeEach(() => {
  vi.stubEnv("SUPABASE_DB_CA_CERT", "test-ca");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createIsolatedPrismaHandle", () => {
  it("passes connection settings and closes both resources once", async () => {
    const handle = createIsolatedPrismaHandle({ connectionString: "postgres://test", applicationName: "c4c2-test" });
    expect(poolConfigs).toContainEqual({
      connectionString: "postgres://test",
      ssl: { ca: "test-ca", rejectUnauthorized: true },
      application_name: "c4c2-test",
    });
    expect(PrismaPgMock).toHaveBeenCalledWith(handle.pool);
    await handle.disconnect();
    await handle.disconnect();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(poolEnd).toHaveBeenCalledTimes(1);
  });

  it("creates independent handles", () => {
    const first = createIsolatedPrismaHandle({ connectionString: "postgres://test", applicationName: "one" });
    const second = createIsolatedPrismaHandle({ connectionString: "postgres://test", applicationName: "two" });
    expect(first.pool).not.toBe(second.pool);
    expect(first.prisma).not.toBe(second.prisma);
  });

  it("disables automatic Prisma logging while preserving adapter failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const failure = new Error("Prisma P2010 SELECT secret at postgres://credentials");
    adapterOperation.mockRejectedValueOnce(failure);
    try {
      const handle = createIsolatedPrismaHandle({ connectionString: "postgres://test", applicationName: "c4c2-no-log" });

      expect(prismaOptions.at(-1)).not.toHaveProperty("log");
      await expect(handle.prisma.$queryRaw`SELECT 1`).rejects.toBe(failure);
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleLog).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      consoleLog.mockRestore();
    }
  });

  it("configures application_name before every checkout", async () => {
    checkoutQuery.mockClear();
    const handle = createIsolatedPrismaHandle({ connectionString: "postgres://test", applicationName: "c4c2-checkout" });
    await handle.pool.connect();
    await handle.pool.connect();
    expect(checkoutQuery).toHaveBeenCalledTimes(2);
    expect(checkoutQuery).toHaveBeenNthCalledWith(1, expect.stringContaining("set_config('application_name', $1, false)"), ["c4c2-checkout"]);
    expect(checkoutQuery.mock.calls[0][0]).not.toContain("c4c2-checkout");
  });

  it("destroys a checkout when application_name cannot be configured", async () => {
    checkoutRelease.mockClear();
    checkoutQuery.mockResolvedValueOnce({ rows: [{ application_name_ok: false }] });
    const handle = createIsolatedPrismaHandle({ connectionString: "postgres://test", applicationName: "c4c2-failure" });
    await expect(handle.pool.connect()).rejects.toThrow("application_name");
    expect(checkoutRelease).toHaveBeenCalledWith(true);
  });

  it("normalizes names deterministically to at most 63 bytes", async () => {
    const longName = `C4C2_${"x".repeat(100)}`;
    expect(normalizeC4C2ApplicationName(longName)).toBe(normalizeC4C2ApplicationName(longName));
    expect(Buffer.byteLength(normalizeC4C2ApplicationName(longName))).toBeLessThanOrEqual(63);
    const client = { query: vi.fn().mockResolvedValue({ rows: [{ application_name_ok: true }] }) };
    await configureApplicationName(client as never, longName);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("$1"), [normalizeC4C2ApplicationName(longName)]);
  });
});

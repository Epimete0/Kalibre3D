import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import { runLocalPrismaMigrate } from "./run-local-prisma-migrate";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn(() => ({ status: 0 })), execFileSync: vi.fn() }));

describe("local Prisma migration wrapper", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["localhost", "127.0.0.1", "[::1]"])("accepts loopback %s and explicitly pins Prisma datasource", (host) => {
    const databaseUrl = `postgresql://postgres:test-secret@${host}:54322/postgres`;
    const status = vi.fn(() => ({ DB_URL: databaseUrl, API_URL: "http://127.0.0.1:54321", PUBLISHABLE_KEY: "local", SERVICE_ROLE_KEY: "local" }));
    expect(runLocalPrismaMigrate({ DATABASE_URL: databaseUrl }, status)).toBe(0);
    expect(spawnSync).toHaveBeenCalledExactlyOnceWith(process.execPath, expect.arrayContaining(["migrate", "deploy"]), expect.objectContaining({
      shell: false,
      env: expect.objectContaining({ DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, SUPABASE_TEST_DATABASE_URL: databaseUrl }),
    }));
  });

  it.each([
    { DIRECT_URL: "postgresql://postgres:test-secret@remote.example.test/postgres" },
    { DATABASE_URL: "postgresql://postgres:test-secret@remote.example.test/postgres" },
    { DIRECT_URL: "https://postgres:test-secret@localhost/postgres" },
  ])("rejects unsafe ambient datasource before any child process", (environment) => {
    expect(() => runLocalPrismaMigrate(environment)).toThrow("QUALITY_GATE_REMOTE_DATABASE_BLOCKED");
    expect(() => runLocalPrismaMigrate(environment)).not.toThrow("test-secret");
    expect(execFileSync).not.toHaveBeenCalled();
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("rejects an unsafe resolved local status before Prisma", () => {
    expect(() => runLocalPrismaMigrate({}, () => ({ DB_URL: "postgresql://postgres:test-secret@remote.example.test/postgres", API_URL: "http://127.0.0.1:54321", PUBLISHABLE_KEY: "local", SERVICE_ROLE_KEY: "local" }))).toThrow("QUALITY_GATE_REMOTE_DATABASE_BLOCKED");
    expect(spawnSync).not.toHaveBeenCalled();
    expect(execFileSync).not.toHaveBeenCalled();
  });
});

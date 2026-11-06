import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "./action-errors";
vi.mock("./prisma", () => ({ prisma: {} }));
import { archiveCenterForOwnerWithDb } from "./center-archive-service-core";

function fixture(owner: unknown = { active: true, role: "OWNER" }) {
  const tx = { $queryRaw: vi.fn()
    .mockResolvedValueOnce([{ id: "center-a", active: true }])
    .mockResolvedValueOnce(owner ? [{ centerId: "center-a", userId: "user-a", ...owner }] : []), centerMember: { findUnique: vi.fn().mockResolvedValue(owner), updateMany: vi.fn() }, center: { update: vi.fn() } };
  const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown, options: unknown) => { void options; return callback(tx); }) };
  return { db, tx };
}

describe("archiveCenterForOwner", () => {
  it("verifies OWNER inside the Serializable transaction after locking Center", async () => {
    const { db, tx } = fixture();
    await archiveCenterForOwnerWithDb({ centerId: "center-a", userId: "user-a", db: db as never });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain("FOR UPDATE");
    expect(tx.$queryRaw.mock.calls[1][0].strings.join(" ")).toContain('FROM "CenterMember"');
    expect(tx.$queryRaw.mock.calls[1][0].strings.join(" ")).toContain('"centerId" = ');
    expect(tx.$queryRaw.mock.calls[1][0].strings.join(" ")).toContain('"userId" = ');
    expect(tx.center.update).toHaveBeenCalled();
  });

  it("rejects non-owner without writes", async () => {
    const { db, tx } = fixture({ active: true, role: "VIEWER" });
    await expect(archiveCenterForOwnerWithDb({ centerId: "center-a", userId: "user-a", db: db as never })).rejects.toEqual(new DomainError("No tienes permiso para archivar este taller."));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.center.update).not.toHaveBeenCalled();
    expect(tx.centerMember.updateMany).not.toHaveBeenCalled();
  });

  it("retries adapter-pg 40001 with a fresh Serializable transaction", async () => {
    const { db } = fixture();
    const failedTx = fixture().tx;
    const retryTx = fixture().tx;
    const conflict = Object.assign(new Error("TransactionWriteConflict"), {
      name: "DriverAdapterError",
      cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
    });
    failedTx.$queryRaw.mockReset().mockRejectedValueOnce({ code: "P2010", meta: { driverAdapterError: conflict } });
    db.$transaction
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(failedTx as never))
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(retryTx as never));

    await expect(archiveCenterForOwnerWithDb({ centerId: "center-a", userId: "user-a", db: db as never })).resolves.toBeUndefined();

    expect(failedTx).not.toBe(retryTx);
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(failedTx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(retryTx.center.update).toHaveBeenCalledTimes(1);
    expect(retryTx.centerMember.updateMany).toHaveBeenCalledTimes(1);
  });

  it("preserves P2034 retries for center archival", async () => {
    const { db } = fixture();
    const failedTx = fixture().tx;
    const retryTx = fixture().tx;
    failedTx.$queryRaw.mockReset().mockRejectedValueOnce({ code: "P2034" });
    db.$transaction
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(failedTx as never))
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(retryTx as never));

    await expect(archiveCenterForOwnerWithDb({ centerId: "center-a", userId: "user-a", db: db as never })).resolves.toBeUndefined();

    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(retryTx.center.update).toHaveBeenCalledTimes(1);
  });

  it("stops after three 40001 conflicts and propagates the final conflict", async () => {
    const { db } = fixture();
    const conflicts = [1, 2, 3].map((attempt) => ({ originalCode: "40001", attempt }));
    const attempts = conflicts.map((conflict) => {
      const tx = fixture().tx;
      tx.$queryRaw.mockReset().mockRejectedValueOnce(conflict);
      return tx;
    });
    db.$transaction.mockImplementation(async (callback: (client: never) => unknown) => {
      const tx = attempts[db.$transaction.mock.calls.length - 1];
      return callback(tx as never);
    });

    await expect(archiveCenterForOwnerWithDb({ centerId: "center-a", userId: "user-a", db: db as never })).rejects.toBe(conflicts[2]);

    expect(db.$transaction).toHaveBeenCalledTimes(3);
    for (const tx of attempts) expect(tx.center.update).not.toHaveBeenCalled();
  });
});

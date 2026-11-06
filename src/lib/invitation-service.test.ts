import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "./action-errors";
vi.mock("./prisma", () => ({ prisma: {} }));
import { redeemInvitationWithDb, INVALID_INVITATION } from "./invitation-service-core";

function fixture() {
  const tx = {
    $queryRaw: vi.fn()
      .mockResolvedValueOnce([{ id: "center-a", active: true }])
      .mockResolvedValueOnce([{ id: "inv-a", centerId: "center-a", codeHash: "hash", role: "ADMIN", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, redeemedAt: null, redeemedByUserId: null }]),
    profile: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    centerMember: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    invitationCode: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const db = { invitationCode: { findFirst: vi.fn().mockResolvedValue({ id: "inv-a", centerId: "center-a" }) }, $transaction: vi.fn(async (callback: (client: typeof tx) => unknown, options: unknown) => { void options; return callback(tx); }) };
  return { db, tx };
}

describe("redeemInvitation", () => {
  beforeEach(() => vi.clearAllMocks());

  function driverAdapterError(originalCode: "40001" | "40P01", kind = "TransactionWriteConflict") {
    return {
      code: "P2010",
      meta: {
        driverAdapterError: Object.assign(new Error(kind), {
          name: "DriverAdapterError",
          cause: { kind, originalCode },
        }),
      },
    };
  }

  it("always owns a Serializable transaction and locks Center before InvitationCode", async () => {
    const { db, tx } = fixture();
    await redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never });
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(tx.$queryRaw.mock.calls[0][0].strings.join(" ")).toContain('FROM "Center"');
    expect(tx.$queryRaw.mock.calls[1][0].strings.join(" ")).toContain('FROM "InvitationCode"');
  });

  it("creates Profile before a new membership and consumes a free invitation", async () => {
    const { db, tx } = fixture();
    await redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", profileData: { displayName: " Ana " }, db: db as never });
    expect(tx.profile.create).toHaveBeenCalledWith({ data: { id: "user-a", displayName: "Ana" } });
    expect(tx.centerMember.create).toHaveBeenCalledWith({ data: { centerId: "center-a", userId: "user-a", role: "ADMIN" } });
    expect(tx.invitationCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ codeHash: "hash", redeemedAt: null }) }));
  });

  it("does not change an existing active role while consuming a free invitation", async () => {
    const { db, tx } = fixture();
    tx.centerMember.findUnique.mockResolvedValue({ active: true, role: "VIEWER" });
    await redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never });
    expect(tx.centerMember.create).not.toHaveBeenCalled();
    expect(tx.invitationCode.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rejects inactive membership without writes", async () => {
    const { db, tx } = fixture();
    tx.centerMember.findUnique.mockResolvedValue({ active: false, role: "ADMIN" });
    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).rejects.toEqual(new DomainError(INVALID_INVITATION));
    expect(tx.profile.upsert).not.toHaveBeenCalled();
    expect(tx.invitationCode.updateMany).not.toHaveBeenCalled();
  });

  it("is idempotent for the same user with active membership and prior redemption", async () => {
    const { db, tx } = fixture();
    tx.$queryRaw.mockReset();
    tx.$queryRaw.mockResolvedValueOnce([{ id: "center-a", active: true }]).mockResolvedValueOnce([{ id: "inv-a", centerId: "center-a", codeHash: "hash", role: "ADMIN", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, redeemedAt: new Date(), redeemedByUserId: "user-a" }]);
    tx.centerMember.findUnique.mockResolvedValue({ active: true, role: "VIEWER" });
    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).resolves.toBe("center-a");
    expect(tx.profile.upsert).not.toHaveBeenCalled();
    expect(tx.invitationCode.updateMany).not.toHaveBeenCalled();
  });

  it("rejects another user without revealing the redeemer", async () => {
    const { db, tx } = fixture();
    tx.$queryRaw.mockReset();
    tx.$queryRaw.mockResolvedValueOnce([{ id: "center-a", active: true }]).mockResolvedValueOnce([{ id: "inv-a", centerId: "center-a", codeHash: "hash", role: "ADMIN", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, redeemedAt: new Date(), redeemedByUserId: "user-b" }]);
    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).rejects.toEqual(new DomainError(INVALID_INVITATION));
  });

  it.each([
    ["Prisma P2034", { code: "P2034" }],
    ["adapter-pg 40001", driverAdapterError("40001")],
    ["adapter-pg 40P01", driverAdapterError("40P01", "postgres")],
  ])("retries %s with a fresh Serializable transaction", async (_name, conflict) => {
    const { db } = fixture();
    const failedTx = fixture().tx;
    const retryTx = fixture().tx;
    failedTx.$queryRaw.mockReset().mockRejectedValueOnce(conflict);
    db.$transaction
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(failedTx as never))
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(retryTx as never));

    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).resolves.toBe("center-a");

    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("retries adapter-pg 40001 and returns only INVALID_INVITATION when archive wins", async () => {
    const { db } = fixture();
    const conflict = driverAdapterError("40001");
    const failedTx = fixture().tx;
    const retryTx = fixture().tx;
    failedTx.$queryRaw.mockReset().mockRejectedValueOnce(conflict);
    retryTx.$queryRaw.mockReset()
      .mockResolvedValueOnce([{ id: "center-a", active: false }])
      .mockResolvedValueOnce([{ id: "inv-a", centerId: "center-a", codeHash: "hash", role: "ADMIN", expiresAt: new Date(Date.now() + 60_000), revokedAt: null, redeemedAt: null, redeemedByUserId: null }]);
    db.$transaction
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(failedTx as never))
      .mockImplementationOnce(async (callback: (client: never) => unknown) => callback(retryTx as never));

    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).rejects.toEqual(new DomainError(INVALID_INVITATION));

    expect(db.$transaction).toHaveBeenCalledTimes(2);
  });

  it("stops after three retryable conflicts without converting the error to INVALID_INVITATION", async () => {
    const { db } = fixture();
    const conflict = driverAdapterError("40001");
    db.$transaction.mockRejectedValue(conflict);

    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).rejects.toBe(conflict);

    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-transaction errors even when their cause graph is cyclic", async () => {
    const { db } = fixture();
    const error = Object.assign(new Error("business failure"), { code: "P2002" }) as Error & { cause?: unknown };
    error.cause = error;
    db.$transaction.mockRejectedValue(error);

    await expect(redeemInvitationWithDb({ userId: "user-a", codeHash: "hash", db: db as never })).rejects.toBe(error);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });
});

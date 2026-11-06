import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "./action-errors";

vi.mock("./prisma", () => ({ prisma: {} }));

import { createCenterForUser } from "./center-service";

function serializableError() {
  return new Prisma.PrismaClientKnownRequestError("serialization failure", { code: "P2034", clientVersion: "test" });
}

describe("createCenterForUser", () => {
  it("rejects a user with an active membership in an active center", async () => {
    const tx = { profile: { upsert: vi.fn() }, centerMember: { findFirst: vi.fn().mockResolvedValue({ centerId: "center-a" }) }, center: { create: vi.fn() } };
    const db = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };

    await expect(createCenterForUser("user-a", { name: "Nuevo", timeZone: "America/Santiago" }, db as never)).rejects.toBeInstanceOf(DomainError);
    expect(tx.center.create).not.toHaveBeenCalled();
  });

  it("creates the center and OWNER in one serializable transaction", async () => {
    const tx = {
      profile: { upsert: vi.fn() },
      centerMember: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
      center: { create: vi.fn().mockResolvedValue({ id: "center-a", name: "Nuevo" }) },
    };
    const db = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };

    await createCenterForUser("user-a", { name: "Nuevo", timeZone: " America/Santiago " }, db as never);

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    expect(tx.profile.upsert).toHaveBeenCalledWith({ where: { id: "user-a" }, create: { id: "user-a" }, update: {} });
    expect(tx.center.create).toHaveBeenCalledWith({ data: { name: "Nuevo", timeZone: "America/Santiago" } });
    expect(tx.centerMember.create).toHaveBeenCalledWith({ data: { centerId: "center-a", userId: "user-a", role: "OWNER" } });
  });

  it("rejects an invalid IANA time zone before starting a transaction", async () => {
    const db = { $transaction: vi.fn() };

    await expect(createCenterForUser("user-a", { name: "Nuevo", timeZone: "GMT+3" }, db as never)).rejects.toThrow("La zona horaria del taller no es válida.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("retries only serialization conflicts and stops after three attempts", async () => {
    const db = { $transaction: vi.fn().mockRejectedValue(serializableError()) };

    await expect(createCenterForUser("user-a", { name: "Nuevo", timeZone: "America/Santiago" }, db as never)).rejects.toBeInstanceOf(DomainError);
    expect(db.$transaction).toHaveBeenCalledTimes(3);
  });
});

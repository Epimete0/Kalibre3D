import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireCatalogContext, requireOperationalContext } = vi.hoisted(() => ({
  prisma: {
    spool: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    spoolMovement: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    moneyTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  requireCatalogContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "11111111-1111-4111-8111-111111111111",
    role: "OWNER",
    timeZone: "America/Santiago",
  }),
  requireOperationalContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "11111111-1111-4111-8111-111111111111",
    role: "PROFESSIONAL",
    timeZone: "America/Santiago",
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireCatalogContext, requireOperationalContext }));

import { createSpool, recordSpoolMovement, setSpoolActive, updateSpool } from "./spool-service";

const VALID_OP_ID = "22222222-2222-4222-8222-222222222222";
const VALID_SPOOL_ID = "33333333-3333-4333-8333-333333333333";

describe("spool-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.spoolMovement.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
  });

  it("crea una bobina con su movimiento INITIAL y opcionalmente registra el gasto de filamento", async () => {
    prisma.spool.create.mockResolvedValueOnce({
      id: VALID_SPOOL_ID,
      material: "PETG",
      color: "Negro",
      remainingGrams: 1000,
    });

    const result = await createSpool({
      operationId: VALID_OP_ID,
      material: "PETG",
      color: "Negro",
      brand: "eSUN",
      totalGrams: 1000,
      pricePaid: 15000,
      recordExpenseInMoney: true,
      paymentMethod: "TRANSFER",
    });

    expect(requireCatalogContext).toHaveBeenCalled();
    expect(prisma.spool.create).toHaveBeenCalled();
    expect(prisma.spoolMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "INITIAL",
          deltaGrams: 1000,
          resultingGrams: 1000,
        }),
      })
    );
    expect(prisma.moneyTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "EXPENSE",
          category: "FILAMENT",
          amount: 15000,
        }),
      })
    );
    expect(result).toEqual({
      id: VALID_SPOOL_ID,
      material: "PETG",
      color: "Negro",
      remainingGrams: 1000,
    });
  });

  it("descuenta gramos con FOR UPDATE y rechaza si quedaría en negativo", async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ id: VALID_SPOOL_ID, remainingGrams: 200 }]);
    prisma.spool.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.spoolMovement.create.mockResolvedValueOnce({
      id: "mov-1",
      spoolId: VALID_SPOOL_ID,
      deltaGrams: -50,
      resultingGrams: 150,
    });

    const ok = await recordSpoolMovement({
      operationId: VALID_OP_ID,
      spoolId: VALID_SPOOL_ID,
      kind: "CONSUME",
      deltaGrams: 50,
    });
    expect(requireOperationalContext).toHaveBeenCalled();
    expect(ok.resultingGrams).toBe(150);

    prisma.$queryRaw.mockResolvedValueOnce([{ id: VALID_SPOOL_ID, remainingGrams: 40 }]);
    await expect(
      recordSpoolMovement({
        operationId: "44444444-4444-4444-8444-444444444444",
        spoolId: VALID_SPOOL_ID,
        kind: "CONSUME",
        deltaGrams: 50,
      })
    ).rejects.toThrow(/No hay suficiente filamento/);
  });

  it("actualiza datos descriptivos y activa/desactiva una bobina exigiendo requireCatalogContext", async () => {
    prisma.spool.updateMany.mockResolvedValue({ count: 1 });
    await updateSpool({
      id: VALID_SPOOL_ID,
      material: "PETG",
      color: "Blanco",
      brand: "Sunlu",
      totalGrams: 1000,
      pricePaid: 14500,
      purchasedOn: "2026-11-08",
    });
    await setSpoolActive({ id: VALID_SPOOL_ID, active: false });
    expect(requireCatalogContext).toHaveBeenCalledTimes(2);
  });
});

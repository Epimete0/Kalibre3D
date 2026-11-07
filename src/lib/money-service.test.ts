import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireCatalogContext, voidOrderMoneyTransaction } = vi.hoisted(() => ({
  prisma: {
    moneyTransaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  requireCatalogContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "center-1",
    role: "OWNER",
    timeZone: "America/Santiago",
  }),
  voidOrderMoneyTransaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireCatalogContext }));
vi.mock("@/lib/order-service", () => ({
  voidMoneyTransaction: voidOrderMoneyTransaction,
}));

import { recordManualMoneyTransaction, voidManualMoneyTransaction } from "./money-service";

const VALID_OP_ID = "44444444-4444-4444-8444-444444444444";

describe("money-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.moneyTransaction.findUnique.mockResolvedValue(null);
    prisma.moneyTransaction.create.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ id: "mtx-1", ...(args.data as object) })
    );
  });

  it("registra un gasto manual (FILAMENT) en la fecha de la zona del taller", async () => {
    // 2026-11-01T01:30:00Z es 2026-10-31 22:30 en America/Santiago (UTC-3)
    const nowInUtc = new Date("2026-11-01T01:30:00.000Z");

    const result = await recordManualMoneyTransaction({
      operationId: VALID_OP_ID,
      type: "EXPENSE",
      category: "FILAMENT",
      amount: 15000,
      method: "TRANSFER",
      notes: "1kg PETG negro",
      now: nowInUtc,
    });

    expect(requireCatalogContext).toHaveBeenCalled();
    expect(prisma.moneyTransaction.create).toHaveBeenCalledWith({
      data: {
        centerId: "center-1",
        operationId: VALID_OP_ID,
        type: "EXPENSE",
        category: "FILAMENT",
        amount: 15000,
        occurredOn: new Date("2026-10-31T00:00:00.000Z"),
        method: "TRANSFER",
        orderId: null,
        notes: "1kg PETG negro",
        recordedByUserId: "user-1",
      },
    });
    expect(result.occurredOn).toBe("2026-10-31");
  });

  it("registra un ingreso suelto de venta de archivos (DIGITAL_SALE)", async () => {
    const result = await recordManualMoneyTransaction({
      operationId: VALID_OP_ID,
      type: "INCOME",
      category: "DIGITAL_SALE",
      amount: 4500,
      method: "OTHER",
      occurredOn: "2026-11-06",
      notes: "Cults3D emblema",
    });

    expect(result).toEqual({
      id: "mtx-1",
      type: "INCOME",
      category: "DIGITAL_SALE",
      amount: 4500,
      occurredOn: "2026-11-06",
    });
  });

  it("es idempotente si el operationId ya existe en el taller", async () => {
    prisma.moneyTransaction.findUnique.mockResolvedValueOnce({
      id: "existing-mtx",
      type: "EXPENSE",
      category: "FILAMENT",
      amount: 15000,
      occurredOn: new Date("2026-11-05T00:00:00.000Z"),
    });

    const result = await recordManualMoneyTransaction({
      operationId: VALID_OP_ID,
      type: "EXPENSE",
      category: "FILAMENT",
      amount: 15000,
      method: "TRANSFER",
    });

    expect(result.id).toBe("existing-mtx");
    expect(prisma.moneyTransaction.create).not.toHaveBeenCalled();
  });

  it("rechaza registrar ORDER_PAYMENT o REFUNDS como movimiento manual sin pedido", async () => {
    await expect(
      recordManualMoneyTransaction({
        operationId: VALID_OP_ID,
        type: "INCOME",
        category: "ORDER_PAYMENT",
        amount: 5000,
        method: "CASH",
      })
    ).rejects.toThrow("La categoría de ingreso manual no es válida.");

    await expect(
      recordManualMoneyTransaction({
        operationId: VALID_OP_ID,
        type: "EXPENSE",
        category: "REFUNDS",
        amount: 5000,
        method: "CASH",
      })
    ).rejects.toThrow("La categoría de gasto no es válida.");
  });

  it("delega la anulación verificando requireCatalogContext", async () => {
    const voidedAt = new Date();
    voidOrderMoneyTransaction.mockResolvedValueOnce({ id: "mtx-1", voidedAt });

    const res = await voidManualMoneyTransaction({
      transactionId: "55555555-5555-4555-8555-555555555555",
      reason: "Error de tipeo",
    });

    expect(requireCatalogContext).toHaveBeenCalled();
    expect(voidOrderMoneyTransaction).toHaveBeenCalled();
    expect(res).toEqual({ id: "mtx-1", voidedAt });
  });
});

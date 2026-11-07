import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireCatalogContext } = vi.hoisted(() => ({
  prisma: {
    moneyTransaction: {
      findMany: vi.fn(),
    },
  },
  requireCatalogContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "center-1",
    role: "OWNER",
    timeZone: "America/Santiago",
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireCatalogContext }));

import { getMonthlyMoneyView } from "./money-queries";

describe("money-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula el resumen mensual por canal y categoría excluyendo anulados", async () => {
    prisma.moneyTransaction.findMany.mockResolvedValueOnce([
      {
        id: "tx-1",
        type: "INCOME",
        category: "ORDER_PAYMENT",
        amount: 6483,
        method: "MERCADOLIBRE",
        occurredOn: new Date("2026-11-06T00:00:00.000Z"),
        notes: null,
        orderId: "ord-1",
        order: { id: "ord-1", number: 1, channel: "MERCADOLIBRE" },
        createdAt: new Date("2026-11-06T12:00:00Z"),
        voidedAt: null,
        voidReason: null,
      },
      {
        id: "tx-2",
        type: "INCOME",
        category: "DIGITAL_SALE",
        amount: 3500,
        method: "OTHER",
        occurredOn: new Date("2026-11-05T00:00:00.000Z"),
        notes: "Cults3D",
        orderId: null,
        order: null,
        createdAt: new Date("2026-11-05T12:00:00Z"),
        voidedAt: null,
        voidReason: null,
      },
      {
        id: "tx-3",
        type: "EXPENSE",
        category: "FILAMENT",
        amount: 15000,
        method: "TRANSFER",
        occurredOn: new Date("2026-11-04T00:00:00.000Z"),
        notes: "Bobina PETG",
        orderId: null,
        order: null,
        createdAt: new Date("2026-11-04T12:00:00Z"),
        voidedAt: new Date("2026-11-04T13:00:00Z"), // Anulado: no debe contar
        voidReason: "Duplicado",
      },
      {
        id: "tx-4",
        type: "EXPENSE",
        category: "FILAMENT",
        amount: 3000,
        method: "TRANSFER",
        occurredOn: new Date("2026-11-04T00:00:00.000Z"),
        notes: "Muestra",
        orderId: null,
        order: null,
        createdAt: new Date("2026-11-04T14:00:00Z"),
        voidedAt: null,
        voidReason: null,
      },
    ]);

    const view = await getMonthlyMoneyView({ month: "2026-11" });
    expect(requireCatalogContext).toHaveBeenCalled();
    expect(view.month).toBe("2026-11");
    expect(view.previousMonth).toBe("2026-10");
    expect(view.nextMonth).toBe("2026-12");
    expect(view.summary.income).toBe(9983); // 6483 + 3500
    expect(view.summary.expense).toBe(3000); // 15000 anulado no cuenta
    expect(view.summary.profit).toBe(6983);
    expect(view.summary.incomeByChannel).toEqual({
      MERCADOLIBRE: 6483,
      DIGITAL: 3500,
    });
    expect(view.summary.expenseByCategory).toEqual({
      FILAMENT: 3000,
    });
  });

  it("determina el mes actual respetando la zona horaria America/Santiago en el borde del día", async () => {
    prisma.moneyTransaction.findMany.mockResolvedValueOnce([]);
    // 2026-11-01 01:30 UTC es 2026-10-31 22:30 en Santiago (UTC-3)
    const view = await getMonthlyMoneyView({
      now: new Date("2026-11-01T01:30:00.000Z"),
    });

    expect(view.month).toBe("2026-10");
    expect(view.todayStr).toBe("2026-10-31");
    expect(prisma.moneyTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          centerId: "center-1",
          occurredOn: {
            gte: new Date("2026-10-01T00:00:00.000Z"),
            lte: new Date("2026-10-31T00:00:00.000Z"),
          },
        },
      })
    );
  });
});

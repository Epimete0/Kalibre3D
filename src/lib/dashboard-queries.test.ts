import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAuthContext,
  getCenterSettings,
  getMonthlyMoneyView,
  listOrders,
  listProducts,
  listSpools,
  prisma,
} = vi.hoisted(() => ({
  prisma: {
    order: { findFirst: vi.fn() },
    spool: { findFirst: vi.fn() },
    centerSettings: { findUnique: vi.fn() },
  },
  requireAuthContext: vi.fn(),
  getCenterSettings: vi.fn(),
  getMonthlyMoneyView: vi.fn(),
  listOrders: vi.fn(),
  listProducts: vi.fn(),
  listSpools: vi.fn(),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireAuthContext,
  };
});
vi.mock("@/lib/center-settings-service", () => ({ getCenterSettings }));
vi.mock("@/lib/money-queries", () => ({ getMonthlyMoneyView }));
vi.mock("@/lib/order-queries", () => ({ listOrders }));
vi.mock("@/lib/product-queries", () => ({ listProducts }));
vi.mock("@/lib/spool-queries", () => ({ listSpools }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { getDashboardOverview } from "./dashboard-queries";

describe("dashboard-queries (Fase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.spool.findFirst.mockResolvedValue(null);
    const createdAt = new Date("2026-11-07T10:00:00.000Z");
    prisma.centerSettings.findUnique.mockResolvedValue({ createdAt, updatedAt: createdAt });

    getCenterSettings.mockResolvedValue({
      centerId: "center-1",
      currency: "CLP",
      timeZone: "America/Santiago",
      electricityCostPerHour: 150,
      mlCommissionPercent: 19,
      mlDefaultShippingCost: 799,
      defaultPackagingCost: 200,
      defaultCostPerKg: 15000,
      defaultPurgeGrams: 15,
      lowSpoolThresholdGrams: 150,
      currencyLocked: true,
    });

    listOrders.mockResolvedValue([
      {
        id: "ord-1",
        number: 1,
        status: "PRINTING",
        channel: "WHATSAPP",
        customerName: "Andrés",
        itemsSummary: "Emblema Ranger",
        dueDate: "2026-11-04",
        isOverdue: true,
        expectedReceivable: 8500,
        balance: 4500,
      },
      {
        id: "ord-2",
        number: 2,
        status: "READY",
        channel: "INSTAGRAM",
        customerName: "Camila",
        itemsSummary: "Soporte PS5",
        dueDate: "2026-11-10",
        isOverdue: false,
        expectedReceivable: 10000,
        balance: 10000,
      },
      {
        id: "ord-3",
        number: 3,
        status: "QUOTED",
        channel: "INSTAGRAM",
        customerName: "Camila",
        itemsSummary: "Emblema 4x4",
        dueDate: "2026-11-12",
        isOverdue: false,
        expectedReceivable: 12000,
        balance: 12000,
      },
    ]);

    listSpools.mockResolvedValue({
      spools: [
        {
          id: "sp-low",
          material: "PETG",
          color: "Gris Plata",
          brand: "Creality",
          totalGrams: 1000,
          remainingGrams: 120,
          isLow: true,
          remainingPct: 12,
          active: true,
        },
      ],
      lowSpoolThresholdGrams: 150,
    });

    listProducts.mockResolvedValue([
      {
        id: "pr-ok",
        name: "Emblema Hilux",
        material: "PETG",
        currentStock: 6,
        minStock: 3,
        isLowStock: false,
        active: true,
      },
      {
        id: "pr-low",
        name: "Emblema Ranger Raptor",
        material: "PETG",
        currentStock: 1,
        minStock: 2,
        isLowStock: true,
        active: true,
      },
    ]);

    getMonthlyMoneyView.mockResolvedValue({
      month: "2026-11",
      previousMonth: "2026-10",
      nextMonth: "2026-12",
      todayStr: "2026-11-08",
      summary: {
        income: 25000,
        expense: 15000,
        profit: 10000,
        incomeByChannel: { WHATSAPP: 18517, MERCADOLIBRE: 6483 },
        expenseByCategory: { FILAMENT: 15000 },
      },
      transactions: [],
    });
  });

  it("OWNER recibe resumen mensual, total por cobrar, conteo por estados y alertas de stock y bobinas", async () => {
    requireAuthContext.mockResolvedValue({
      userId: "u-owner",
      centerId: "center-1",
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    const view = await getDashboardOverview({ month: "2026-11" });

    expect(view.currency).toBe("CLP");
    expect(view.moneyView?.month).toBe("2026-11");
    expect(view.pendingReceivableTotal).toBe(26500);
    expect(view.overdueOrders).toHaveLength(1);
    expect(view.upcomingOrders).toHaveLength(2);
    expect(view.statusCounts).toEqual({
      QUOTED: 1,
      CONFIRMED: 0,
      PRINTING: 1,
      READY: 1,
    });
    expect(view.lowSpools).toHaveLength(1);
    expect(view.lowSpools[0]?.color).toBe("Gris Plata");
    expect(view.lowStockProducts).toHaveLength(1);
    expect(view.lowStockProducts[0]?.name).toBe("Emblema Ranger Raptor");
  });

  it("PROFESSIONAL recibe alertas operativas y conteos por estado, pero no resumen de dinero ni saldos por cobrar", async () => {
    requireAuthContext.mockResolvedValue({
      userId: "u-pro",
      centerId: "center-1",
      role: "PROFESSIONAL",
      timeZone: "America/Santiago",
    });

    const view = await getDashboardOverview();

    expect(getMonthlyMoneyView).not.toHaveBeenCalled();
    expect(view.moneyView).toBeNull();
    expect(view.pendingReceivableTotal).toBeNull();
    expect(view.lowSpools).toHaveLength(1);
    expect(view.lowStockProducts).toHaveLength(1);
    expect(view.statusCounts.PRINTING).toBe(1);
  });

  it("VIEWER recibe carga operativa de pedidos sin invocar consultas de dinero ni configuraciones restringidas", async () => {
    requireAuthContext.mockResolvedValue({
      userId: "u-viewer",
      centerId: "center-1",
      role: "VIEWER",
      timeZone: "America/Santiago",
    });

    const view = await getDashboardOverview();

    expect(getMonthlyMoneyView).not.toHaveBeenCalled();
    expect(getCenterSettings).not.toHaveBeenCalled();
    expect(listProducts).not.toHaveBeenCalled();
    expect(view.moneyView).toBeNull();
    expect(view.pendingReceivableTotal).toBeNull();
    expect(view.lowSpools).toEqual([]);
    expect(view.lowStockProducts).toEqual([]);
    expect(view.overdueOrders).toHaveLength(1);
  });
  it("OWNER de un taller nuevo ve los primeros pasos, consultados solo en su taller", async () => {
    requireAuthContext.mockResolvedValue({ userId: "u-owner", centerId: "center-1", role: "OWNER", timeZone: "America/Santiago" });
    prisma.order.findFirst.mockResolvedValue({ id: "ord-1" });

    const view = await getDashboardOverview();

    expect(prisma.order.findFirst).toHaveBeenCalledWith({ where: { centerId: "center-1" }, select: { id: true } });
    expect(prisma.spool.findFirst).toHaveBeenCalledWith({ where: { centerId: "center-1" }, select: { id: true } });
    expect(view.gettingStarted?.completed).toBe(1);
    expect(view.gettingStarted?.steps.map((step) => step.done)).toEqual([true, false, false]);
  });

  it("los primeros pasos desaparecen cuando están todos hechos", async () => {
    requireAuthContext.mockResolvedValue({ userId: "u-owner", centerId: "center-1", role: "OWNER", timeZone: "America/Santiago" });
    prisma.order.findFirst.mockResolvedValue({ id: "ord-1" });
    prisma.spool.findFirst.mockResolvedValue({ id: "sp-1" });
    prisma.centerSettings.findUnique.mockResolvedValue({
      createdAt: new Date("2026-11-07T10:00:00.000Z"),
      updatedAt: new Date("2026-11-07T11:00:00.000Z"),
    });

    expect((await getDashboardOverview()).gettingStarted).toBeNull();
  });

  it("Ayudante y Lector no ven ni consultan los primeros pasos", async () => {
    for (const role of ["PROFESSIONAL", "VIEWER"] as const) {
      vi.clearAllMocks();
      requireAuthContext.mockResolvedValue({ userId: "u", centerId: "center-1", role, timeZone: "America/Santiago" });
      const view = await getDashboardOverview();
      expect(view.gettingStarted).toBeNull();
      expect(prisma.order.findFirst).not.toHaveBeenCalled();
    }
  });
});


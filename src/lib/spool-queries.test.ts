import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireAuthContext, getCenterSettings } = vi.hoisted(() => ({
  prisma: {
    spool: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    profile: {
      findMany: vi.fn(),
    },
  },
  requireAuthContext: vi.fn(),
  getCenterSettings: vi.fn().mockResolvedValue({
    currency: "CLP",
    lowSpoolThresholdGrams: 150,
    defaultCostPerKg: 15000,
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireAuthContext }));
vi.mock("@/lib/center-settings-service", () => ({ getCenterSettings }));

import { getSpoolDetail, listSpools } from "./spool-queries";

describe("spool-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calcula el estado de poco filamento, porcentaje restante y oculta precios a VIEWER", async () => {
    requireAuthContext.mockResolvedValueOnce({
      userId: "u-viewer",
      centerId: "c-1",
      role: "VIEWER",
    });
    prisma.spool.findMany.mockResolvedValueOnce([
      {
        id: "s-1",
        material: "PETG",
        color: "Negro",
        brand: "eSUN",
        totalGrams: 1000,
        remainingGrams: 120,
        pricePaid: 15000,
        purchasedOn: new Date("2026-11-08T00:00:00.000Z"),
        notes: null,
        active: true,
      },
    ]);

    const view = await listSpools();
    expect(view.canSeeMoney).toBe(false);
    expect(view.spools[0].isLow).toBe(true);
    expect(view.spools[0].remainingPct).toBe(12);
    expect(view.spools[0].pricePaid).toBeNull();
  });

  it("obtiene el detalle de una bobina con sus movimientos y nombres de integrantes", async () => {
    requireAuthContext.mockResolvedValueOnce({
      userId: "u-owner",
      centerId: "c-1",
      role: "OWNER",
    });
    prisma.spool.findFirst.mockResolvedValueOnce({
      id: "s-1",
      material: "PETG",
      color: "Rojo",
      brand: "eSUN",
      totalGrams: 1000,
      remainingGrams: 850,
      pricePaid: 15000,
      purchasedOn: new Date("2026-11-08T00:00:00.000Z"),
      notes: "Caja 1",
      active: true,
      movements: [
        {
          id: "m-1",
          kind: "CONSUME",
          deltaGrams: -150,
          resultingGrams: 850,
          order: { id: "o-1", number: 4 },
          notes: "3 emblemas",
          actorUserId: "u-owner",
          createdAt: new Date("2026-11-08T12:00:00.000Z"),
        },
      ],
    });
    prisma.profile.findMany.mockResolvedValueOnce([{ id: "u-owner", displayName: "Benja" }]);

    const detail = await getSpoolDetail("s-1");
    expect(detail?.pricePaid).toBe(15000);
    expect(detail?.movements[0].actorName).toBe("Benja");
    expect(detail?.movements[0].orderNumber).toBe(4);
  });
});

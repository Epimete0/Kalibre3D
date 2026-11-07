import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireAuthContext } = vi.hoisted(() => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
  },
  requireAuthContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "center-1",
    role: "OWNER",
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireAuthContext }));

import { listOrdersSummary } from "./order-queries";

describe("order-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista pedidos para el taller activo", async () => {
    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: "order-1",
        number: 1,
        channel: "WHATSAPP",
        status: "DELIVERED",
        kind: "QUICK_SALE",
        total: 15000,
        createdAt: new Date("2026-11-01"),
        deliveredAt: new Date("2026-11-01"),
        dueDate: null,
        customer: { id: "cust-1", name: "Carlos" },
        _count: { items: 2 },
      },
    ]);

    const result = await listOrdersSummary();
    expect(requireAuthContext).toHaveBeenCalled();
    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1" },
      include: expect.any(Object),
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    });
    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe("Carlos");
    expect(result[0].total).toBe(15000);
  });

  it("oculta los totales para rol VIEWER", async () => {
    requireAuthContext.mockResolvedValueOnce({
      userId: "viewer-1",
      centerId: "center-1",
      role: "VIEWER",
    });

    prisma.order.findMany.mockResolvedValueOnce([
      {
        id: "order-1",
        number: 1,
        channel: "WHATSAPP",
        status: "DELIVERED",
        kind: "QUICK_SALE",
        total: 15000,
        createdAt: new Date(),
        deliveredAt: new Date(),
        dueDate: null,
        customer: null,
        _count: { items: 1 },
      },
    ]);

    const result = await listOrdersSummary();
    expect(result[0].total).toBeNull();
  });
});

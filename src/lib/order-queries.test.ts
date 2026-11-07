import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireAuthContext } = vi.hoisted(() => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    centerMember: {
      findMany: vi.fn(),
    },
  },
  requireAuthContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "center-1",
    role: "OWNER",
    timeZone: "America/Santiago",
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireAuthContext }));

import { getOrderDetail, listOrders, listOrdersSummary } from "./order-queries";

describe("order-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.centerMember.findMany.mockResolvedValue([]);
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
      timeZone: "America/Santiago",
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

  describe("listOrders", () => {
    it("ordena pedidos atrasados primero y filtra por cliente sin tildes o número", async () => {
      prisma.order.findMany.mockResolvedValueOnce([
        {
          id: "order-3",
          number: 3,
          kind: "ORDER",
          channel: "WHATSAPP",
          status: "CONFIRMED",
          version: 1,
          dueDate: new Date("2099-12-31T00:00:00.000Z"),
          total: 10000,
          mlCommission: 0,
          mlShippingCost: 0,
          createdAt: new Date("2026-11-05"),
          deliveredAt: null,
          customer: { id: "c1", name: "Andrés Cárcamo", phone: null, instagram: null },
          items: [{ qty: 2, description: "Emblema Hilux" }],
          transactions: [{ amount: 4000, voidedAt: null }],
        },
        {
          id: "order-2",
          number: 2,
          kind: "ORDER",
          channel: "INSTAGRAM",
          status: "PRINTING",
          version: 2,
          dueDate: new Date("2020-01-10T00:00:00.000Z"), // Atrasado
          total: 20000,
          mlCommission: 0,
          mlShippingCost: 0,
          createdAt: new Date("2026-11-02"),
          deliveredAt: null,
          customer: { id: "c2", name: "María Carcamo", phone: "+5691234", instagram: "maria" },
          items: [{ qty: 1, description: "Soporte Pared" }],
          transactions: [],
        },
      ]);

      const result = await listOrders({ query: "carcamo" });
      expect(result).toHaveLength(2);
      // El pedido #2 está atrasado, por lo que debe aparecer antes que el #3
      expect(result[0].number).toBe(2);
      expect(result[0].isOverdue).toBe(true);
      expect(result[0].balance).toBe(20000);

      expect(result[1].number).toBe(3);
      expect(result[1].isOverdue).toBe(false);
      expect(result[1].balance).toBe(6000);
      expect(result[1].itemsSummary).toBe("2× Emblema Hilux");
    });

    it("busca por número con prefijo #", async () => {
      prisma.order.findMany.mockResolvedValueOnce([
        {
          id: "order-12",
          number: 12,
          kind: "QUICK_SALE",
          channel: "IN_PERSON",
          status: "DELIVERED",
          version: 1,
          dueDate: null,
          total: 5000,
          mlCommission: 0,
          mlShippingCost: 0,
          createdAt: new Date(),
          deliveredAt: new Date(),
          customer: null,
          items: [{ qty: 1, description: "Llavero" }],
          transactions: [{ amount: 5000, voidedAt: null }],
        },
        {
          id: "order-5",
          number: 5,
          kind: "QUICK_SALE",
          channel: "IN_PERSON",
          status: "DELIVERED",
          version: 1,
          dueDate: null,
          total: 3000,
          mlCommission: 0,
          mlShippingCost: 0,
          createdAt: new Date(),
          deliveredAt: new Date(),
          customer: null,
          items: [{ qty: 1, description: "Otro" }],
          transactions: [],
        },
      ]);

      const result = await listOrders({ query: "#12" });
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(12);
    });
  });

  describe("getOrderDetail", () => {
    const VALID_ID = "11111111-1111-4111-8111-111111111111";

    it("retorna null si el ID no es un UUID válido", async () => {
      const detail = await getOrderDetail("invalid-id");
      expect(detail).toBeNull();
      expect(prisma.order.findFirst).not.toHaveBeenCalled();
    });

    it("calcula el neto esperado de Mercado Libre, saldo y eventos", async () => {
      prisma.order.findFirst.mockResolvedValueOnce({
        id: VALID_ID,
        centerId: "center-1",
        number: 7,
        kind: "ORDER",
        channel: "MERCADOLIBRE",
        status: "READY",
        version: 3,
        dueDate: new Date("2026-11-20T00:00:00.000Z"),
        discount: 0,
        total: 8990,
        mlOrderRef: "ML-2000",
        mlCommission: 1708,
        mlShippingCost: 799,
        notes: "Enviar por Chilexpress",
        createdAt: new Date("2026-11-06T12:00:00Z"),
        deliveredAt: null,
        customer: {
          id: "cust-1",
          name: "Pedro",
          phone: "+5699999",
          instagram: "pedro3d",
        },
        items: [
          {
            id: "item-1",
            position: 1,
            productId: null,
            description: "Emblema",
            qty: 1,
            unitPrice: 8990,
            material: "PETG",
            grams: 50,
            colorsCount: 2,
          },
        ],
        events: [
          {
            id: "ev-1",
            version: 1,
            fromStatus: null,
            toStatus: "CONFIRMED",
            actorUserId: "user-1",
            occurredAt: new Date("2026-11-06T12:00:00Z"),
          },
        ],
        transactions: [
          {
            id: "tx-1",
            type: "INCOME",
            category: "ORDER_PAYMENT",
            amount: 2000,
            method: "MERCADOLIBRE",
            occurredOn: new Date("2026-11-06T00:00:00.000Z"),
            notes: "Abono",
            createdAt: new Date("2026-11-06T12:05:00Z"),
            voidedAt: null,
            voidReason: null,
          },
        ],
      });

      prisma.centerMember.findMany.mockResolvedValueOnce([
        {
          userId: "user-1",
          profile: { displayName: "Surko Maker" },
        },
      ]);

      const detail = await getOrderDetail(VALID_ID);
      expect(detail).not.toBeNull();
      expect(detail?.expectedReceivable).toBe(6483); // 8990 - 1708 - 799
      expect(detail?.paidAmount).toBe(2000);
      expect(detail?.balance).toBe(4483);
      expect(detail?.events[0].actorName).toBe("Surko Maker");
    });
  });
});

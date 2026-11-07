import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireAuthContext } = vi.hoisted(() => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  requireAuthContext: vi.fn().mockResolvedValue({
    userId: "user-owner",
    centerId: "center-a",
    role: "OWNER",
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireAuthContext }));

import { getCustomerDetail, listCustomers, normalizeSearchText } from "./customer-queries";

describe("customer-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthContext.mockResolvedValue({
      userId: "user-owner",
      centerId: "center-a",
      role: "OWNER",
    });
  });

  describe("normalizeSearchText", () => {
    it("elimina acentos y tildes y pasa a minúsculas", () => {
      expect(normalizeSearchText("  García  ")).toBe("garcia");
      expect(normalizeSearchText("JOSÉ")).toBe("jose");
      expect(normalizeSearchText("Cañón")).toBe("canon");
      expect(normalizeSearchText("Pingüino")).toBe("pinguino");
    });
  });

  describe("listCustomers", () => {
    it("lista clientes calculando ventas y saldo pendiente", async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        {
          id: "cust-1",
          name: "Sebastián Pérez",
          phone: "+56911112222",
          instagram: "seba.3d",
          notes: "Nota cliente",
          active: true,
          createdAt: new Date("2026-11-01T12:00:00Z"),
          _count: { orders: 2 },
          orders: [
            {
              id: "order-1",
              total: 10000,
              channel: "DIRECT",
              status: "CONFIRMED",
              mlCommission: 0,
              mlShippingCost: 0,
              transactions: [
                { amount: 4000, voidedAt: null },
                { amount: 1000, voidedAt: new Date() }, // anulado: no cuenta
              ],
            },
            {
              id: "order-2",
              total: 5000,
              channel: "MERCADOLIBRE",
              status: "DELIVERED",
              mlCommission: 950,
              mlShippingCost: 0,
              transactions: [
                { amount: 4050, voidedAt: null }, // 5000 - 950 = 4050 neto -> pagado completo
              ],
            },
          ],
        },
      ]);

      const result = await listCustomers();

      expect(requireAuthContext).toHaveBeenCalled();
      expect(prisma.customer.findMany).toHaveBeenCalledWith({
        where: { centerId: "center-a", active: true },
        include: expect.any(Object),
        orderBy: [{ active: "desc" }, { name: "asc" }],
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "cust-1",
        name: "Sebastián Pérez",
        phone: "+56911112222",
        instagram: "seba.3d",
        notes: "Nota cliente",
        active: true,
        createdAt: new Date("2026-11-01T12:00:00Z"),
        ordersCount: 2,
        totalSpent: 15000,
        pendingBalance: 6000, // order-1: 10000 - 4000 = 6000. order-2 entregado y con saldo 0
      });
    });

    it("filtra por búsqueda insensible a tildes y mayúsculas", async () => {
      prisma.customer.findMany.mockResolvedValueOnce([
        {
          id: "cust-1",
          name: "Martín Cárcamo",
          phone: "+56912345678",
          instagram: "martin_c",
          notes: null,
          active: true,
          createdAt: new Date(),
          _count: { orders: 0 },
          orders: [],
        },
        {
          id: "cust-2",
          name: "Valeria Soto",
          phone: "+56999998888",
          instagram: "valeria.3d",
          notes: null,
          active: true,
          createdAt: new Date(),
          _count: { orders: 0 },
          orders: [],
        },
      ]);

      // Buscar "carcamo" sin tilde debe coincidir con "Cárcamo"
      const result = await listCustomers({ search: "carcamo" });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("cust-1");

      // Buscar por instagram
      prisma.customer.findMany.mockResolvedValueOnce([
        {
          id: "cust-1",
          name: "Martín Cárcamo",
          phone: "+56912345678",
          instagram: "martin_c",
          notes: null,
          active: true,
          createdAt: new Date(),
          _count: { orders: 0 },
          orders: [],
        },
      ]);
      const resultInsta = await listCustomers({ search: "martin_c" });
      expect(resultInsta).toHaveLength(1);
    });

    it("oculta montos de dinero para rol VIEWER", async () => {
      requireAuthContext.mockResolvedValueOnce({
        userId: "user-viewer",
        centerId: "center-a",
        role: "VIEWER",
      });

      prisma.customer.findMany.mockResolvedValueOnce([
        {
          id: "cust-1",
          name: "Cliente A",
          phone: "+56911112222",
          instagram: null,
          notes: null,
          active: true,
          createdAt: new Date(),
          _count: { orders: 1 },
          orders: [
            {
              id: "order-1",
              total: 10000,
              channel: "DIRECT",
              status: "CONFIRMED",
              mlCommission: 0,
              mlShippingCost: 0,
              transactions: [],
            },
          ],
        },
      ]);

      const result = await listCustomers();
      expect(result[0].ordersCount).toBe(1);
      expect(result[0].totalSpent).toBeNull();
      expect(result[0].pendingBalance).toBeNull();
    });
  });

  describe("getCustomerDetail", () => {
    it("obtiene el detalle del cliente con sus pedidos", async () => {
      prisma.customer.findFirst.mockResolvedValueOnce({
        id: "cust-1",
        centerId: "center-a",
        name: "Rodrigo",
        phone: "+56988887777",
        instagram: "rodrigo.maker",
        notes: "Cliente preferencial",
        active: true,
        createdAt: new Date("2026-11-01T10:00:00Z"),
        orders: [
          {
            id: "order-1",
            number: 14,
            channel: "WHATSAPP",
            status: "IN_PROGRESS",
            total: 20000,
            mlCommission: 0,
            mlShippingCost: 0,
            dueDate: new Date("2026-11-10"),
            createdAt: new Date("2026-11-02T10:00:00Z"),
            transactions: [{ amount: 10000, voidedAt: null }],
            _count: { items: 3 },
          },
        ],
      });

      const customer = await getCustomerDetail("cust-1");
      expect(customer).not.toBeNull();
      expect(customer?.name).toBe("Rodrigo");
      expect(customer?.orders).toHaveLength(1);
      expect(customer?.orders[0]).toEqual({
        id: "order-1",
        number: 14,
        channel: "WHATSAPP",
        status: "IN_PROGRESS",
        total: 20000,
        balance: 10000,
        paid: 10000,
        dueDate: new Date("2026-11-10"),
        createdAt: new Date("2026-11-02T10:00:00Z"),
        itemsCount: 3,
      });
      expect(customer?.totalSpent).toBe(20000);
      expect(customer?.pendingBalance).toBe(10000);
    });

    it("retorna null si el cliente no existe", async () => {
      prisma.customer.findFirst.mockResolvedValueOnce(null);
      const customer = await getCustomerDetail("non-existent");
      expect(customer).toBeNull();
    });
  });
});

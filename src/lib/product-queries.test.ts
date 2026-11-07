import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireOperationalContext } = vi.hoisted(() => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    profile: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  requireOperationalContext: vi.fn().mockResolvedValue({ userId: "user-a", centerId: "center-a", role: "OWNER" }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireOperationalContext }));

import { getProductById, listProducts } from "./product-queries";

describe("product-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lista piezas filtrando por centerId y activas por defecto", async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Emblema",
        category: "Emblemas",
        material: "PETG",
        grams: 50,
        printMinutes: 90,
        colorsCount: 2,
        purgeGrams: 15,
        salePrice: 8990,
        mlPrice: 10990,
        currentStock: 1,
        minStock: 2,
        active: true,
        createdAt: new Date(),
        _count: { orderItems: 2 },
        movements: [],
      },
    ]);

    const result = await listProducts();
    expect(requireOperationalContext).toHaveBeenCalled();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-a", active: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].hasOrders).toBe(true);
    expect(result[0].isLowStock).toBe(true);
  });

  it("incluye inactivas y búsqueda si se solicitan", async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await listProducts({ search: "hilux", includeInactive: true });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          centerId: "center-a",
          name: { contains: "hilux", mode: "insensitive" },
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      })
    );
  });

  it("obtiene una pieza por id garantizando centerId", async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: "p1",
      name: "Emblema",
      salePrice: 8990,
      mlPrice: null,
      active: true,
      createdAt: new Date(),
      _count: { orderItems: 0 },
      movements: [],
    });

    const result = await getProductById("p1");
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p1", centerId: "center-a" },
      })
    );
    expect(result?.hasOrders).toBe(false);
  });
});

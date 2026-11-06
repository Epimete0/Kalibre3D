import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireOperationalContext } = vi.hoisted(() => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
        salePrice: 8990,
        mlPrice: 10990,
        active: true,
        createdAt: new Date(),
        _count: { orderItems: 2 },
      },
    ]);

    const result = await listProducts();
    expect(requireOperationalContext).toHaveBeenCalled();
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-a", active: true },
      include: { _count: { select: { orderItems: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].hasOrders).toBe(true);
  });

  it("incluye inactivas y búsqueda si se solicitan", async () => {
    prisma.product.findMany.mockResolvedValue([]);
    await listProducts({ search: "hilux", includeInactive: true });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        centerId: "center-a",
        name: { contains: "hilux", mode: "insensitive" },
      },
      include: { _count: { select: { orderItems: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
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
    });

    const result = await getProductById("p1");
    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: "p1", centerId: "center-a" },
      include: { _count: { select: { orderItems: true } } },
    });
    expect(result?.hasOrders).toBe(false);
  });
});

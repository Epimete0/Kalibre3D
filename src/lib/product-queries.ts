import { requireOperationalContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ProductListItem = {
  id: string;
  name: string;
  salePrice: number;
  mlPrice: number | null;
  active: boolean;
  createdAt: Date;
  hasOrders: boolean;
};

export async function listProducts(options?: { search?: string; includeInactive?: boolean }): Promise<ProductListItem[]> {
  const { centerId } = await requireOperationalContext();

  const search = options?.search?.trim();

  const products = await prisma.product.findMany({
    where: {
      centerId,
      ...(options?.includeInactive ? {} : { active: true }),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: {
      _count: {
        select: { orderItems: true },
      },
    },
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });

  return products.map((item) => ({
    id: item.id,
    name: item.name,
    salePrice: item.salePrice,
    mlPrice: item.mlPrice,
    active: item.active,
    createdAt: item.createdAt,
    hasOrders: item._count.orderItems > 0,
  }));
}

export async function getProductById(id: string) {
  const { centerId } = await requireOperationalContext();

  const item = await prisma.product.findFirst({
    where: { id, centerId },
    include: {
      _count: {
        select: { orderItems: true },
      },
    },
  });

  if (!item) return null;

  return {
    id: item.id,
    name: item.name,
    salePrice: item.salePrice,
    mlPrice: item.mlPrice,
    active: item.active,
    createdAt: item.createdAt,
    hasOrders: item._count.orderItems > 0,
  };
}

import { requireOperationalContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ProductListItem = {
  id: string;
  name: string;
  category: string | null;
  material: string;
  grams: number;
  printMinutes: number;
  colorsCount: number;
  purgeGrams: number;
  salePrice: number;
  mlPrice: number | null;
  currentStock: number;
  minStock: number;
  isLowStock: boolean;
  active: boolean;
  createdAt: Date;
  hasOrders: boolean;
  hasRealMovements: boolean;
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
      movements: {
        where: { kind: { not: "INITIAL" } },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [
      { active: "desc" },
      { name: "asc" },
    ],
  });

  return products.map((item) => {
    const material = item.material ?? "PETG";
    const grams = item.grams ?? 0;
    const printMinutes = item.printMinutes ?? 0;
    const colorsCount = item.colorsCount ?? 1;
    const purgeGrams = item.purgeGrams ?? 0;
    const currentStock = item.currentStock ?? 0;
    const minStock = item.minStock ?? 0;
    const isLowStock = item.active && minStock > 0 && currentStock <= minStock;
    return {
      id: item.id,
      name: item.name,
      category: item.category ?? null,
      material,
      grams,
      printMinutes,
      colorsCount,
      purgeGrams,
      salePrice: item.salePrice,
      mlPrice: item.mlPrice,
      currentStock,
      minStock,
      isLowStock,
      active: item.active,
      createdAt: item.createdAt,
      hasOrders: item._count.orderItems > 0,
      hasRealMovements: (item.movements?.length ?? 0) > 0,
    };
  });
}

export type ProductDetailMovement = {
  id: string;
  kind: string;
  delta: number;
  resultingStock: number;
  orderId: string | null;
  orderNumber: number | null;
  notes: string | null;
  actorName: string;
  createdAt: Date;
};

export type ProductDetailView = ProductListItem & {
  movements: ProductDetailMovement[];
};

export async function getProductById(id: string): Promise<ProductDetailView | null> {
  const { centerId } = await requireOperationalContext();

  const item = await prisma.product.findFirst({
    where: { id, centerId },
    include: {
      _count: {
        select: { orderItems: true },
      },
      movements: {
        include: {
          order: { select: { id: true, number: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!item) return null;

  const rawMovements = item.movements ?? [];
  const actorIds = [...new Set(rawMovements.map((m) => m.actorUserId))];
  const profiles =
    actorIds.length > 0 && prisma.profile?.findMany
      ? await prisma.profile.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, displayName: true },
        })
      : [];
  const profileMap = new Map(profiles.map((p) => [p.id, p.displayName ?? "Integrante"]));

  const material = item.material ?? "PETG";
  const grams = item.grams ?? 0;
  const printMinutes = item.printMinutes ?? 0;
  const colorsCount = item.colorsCount ?? 1;
  const purgeGrams = item.purgeGrams ?? 0;
  const currentStock = item.currentStock ?? 0;
  const minStock = item.minStock ?? 0;
  const isLowStock = item.active && minStock > 0 && currentStock <= minStock;

  return {
    id: item.id,
    name: item.name,
    category: item.category ?? null,
    material,
    grams,
    printMinutes,
    colorsCount,
    purgeGrams,
    salePrice: item.salePrice,
    mlPrice: item.mlPrice,
    currentStock,
    minStock,
    isLowStock,
    active: item.active,
    createdAt: item.createdAt,
    hasOrders: item._count.orderItems > 0,
    hasRealMovements: rawMovements.some((m) => m.kind !== "INITIAL"),
    movements: rawMovements.map((m) => ({
      id: m.id,
      kind: m.kind,
      delta: m.delta,
      resultingStock: m.resultingStock,
      orderId: m.order?.id ?? null,
      orderNumber: m.order?.number ?? null,
      notes: m.notes,
      actorName: profileMap.get(m.actorUserId) ?? "Integrante",
      createdAt: m.createdAt,
    })),
  };
}

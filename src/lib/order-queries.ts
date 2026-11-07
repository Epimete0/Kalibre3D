import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type OrderSummaryItem = {
  id: string;
  number: number;
  channel: string;
  status: string;
  kind: string;
  total: number | null;
  customerName: string | null;
  customerId: string | null;
  itemsCount: number;
  createdAt: Date;
  deliveredAt: Date | null;
  dueDate: Date | null;
};

export async function listOrdersSummary(options?: {
  limit?: number;
}): Promise<OrderSummaryItem[]> {
  const { centerId, role } = await requireAuthContext();

  const orders = await prisma.order.findMany({
    where: { centerId },
    include: {
      customer: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: [{ createdAt: "desc" }],
    take: options?.limit ?? 50,
  });

  return orders.map((o) => ({
    id: o.id,
    number: o.number,
    channel: o.channel,
    status: o.status,
    kind: o.kind,
    total: role === "VIEWER" ? null : o.total,
    customerName: o.customer?.name ?? null,
    customerId: o.customer?.id ?? null,
    itemsCount: o._count.items,
    createdAt: o.createdAt,
    deliveredAt: o.deliveredAt,
    dueDate: o.dueDate,
  }));
}

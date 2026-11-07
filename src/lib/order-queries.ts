import { requireAuthContext } from "@/lib/auth";
import { normalizeSearchText } from "@/lib/customer-queries";
import {
  isClosedStatus,
  ORDER_CHANNELS,
  ORDER_STATUSES,
  type OrderChannel,
  type OrderKind,
  type OrderStatus,
} from "@/lib/order-status";
import { expectedReceivable, isOverdue, orderBalance, orderSubtotal } from "@/lib/order-totals";
import { prisma } from "@/lib/prisma";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export type OrderListFilterStatus = OrderStatus | "ALL" | "ACTIVE";
export type OrderListFilterChannel = OrderChannel | "ALL";

export type OrderListFilters = {
  status?: OrderListFilterStatus;
  channel?: OrderListFilterChannel;
  query?: string;
};

export type OrderListItem = {
  id: string;
  number: number;
  kind: OrderKind;
  channel: OrderChannel;
  status: OrderStatus;
  version: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerInstagram: string | null;
  itemsCount: number;
  itemsSummary: string;
  dueDate: string | null;
  isOverdue: boolean;
  total: number | null;
  expectedReceivable: number | null;
  balance: number | null;
  createdAt: Date;
  deliveredAt: Date | null;
};

function formatDateOnly(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export async function listOrders(filters?: OrderListFilters): Promise<OrderListItem[]> {
  const { centerId, role, timeZone } = await requireAuthContext();
  const tz = timeZone ?? "America/Santiago";
  const now = new Date();

  const statusFilter = filters?.status;
  const channelFilter = filters?.channel;

  const whereClause: {
    centerId: string;
    status?: string | { in: string[] };
    channel?: string;
  } = { centerId };

  if (statusFilter === "ACTIVE") {
    whereClause.status = {
      in: ORDER_STATUSES.filter((s) => !isClosedStatus(s)),
    };
  } else if (
    statusFilter &&
    statusFilter !== "ALL" &&
    (ORDER_STATUSES as readonly string[]).includes(statusFilter)
  ) {
    whereClause.status = statusFilter;
  }

  if (
    channelFilter &&
    channelFilter !== "ALL" &&
    (ORDER_CHANNELS as readonly string[]).includes(channelFilter)
  ) {
    whereClause.channel = channelFilter;
  }

  const rawOrders = await prisma.order.findMany({
    where: whereClause,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          instagram: true,
        },
      },
      items: {
        orderBy: { position: "asc" },
        select: {
          qty: true,
          description: true,
        },
      },
      transactions: {
        where: { type: "INCOME" },
        select: {
          amount: true,
          voidedAt: true,
        },
      },
    },
    orderBy: [{ number: "desc" }],
  });

  const normalizedQuery = filters?.query ? normalizeSearchText(filters.query) : "";
  const numericQuery = normalizedQuery.startsWith("#")
    ? normalizedQuery.slice(1).trim()
    : normalizedQuery;

  const filtered = rawOrders.filter((order) => {
    if (!normalizedQuery) return true;
    const numberStr = String(order.number);
    if (numericQuery && numberStr.includes(numericQuery)) {
      return true;
    }
    if (order.customer?.name && normalizeSearchText(order.customer.name).includes(normalizedQuery)) {
      return true;
    }
    if (
      order.items.some((item) =>
        normalizeSearchText(item.description).includes(normalizedQuery)
      )
    ) {
      return true;
    }
    return false;
  });

  const mapped: OrderListItem[] = filtered.map((order) => {
    const status = order.status as OrderStatus;
    const channel = order.channel as OrderChannel;
    const kind = order.kind as OrderKind;
    const dueDateStr = formatDateOnly(order.dueDate);
    const overdue = isOverdue({ dueDate: dueDateStr, status }, now, tz);

    const expected = expectedReceivable({
      channel,
      total: order.total,
      mlCommission: order.mlCommission,
      mlShippingCost: order.mlShippingCost,
    });
    const balance = orderBalance(
      expected,
      order.transactions.map((t) => ({
        amount: t.amount,
        voided: t.voidedAt !== null,
      }))
    );

    const totalPieces = order.items.reduce((acc, item) => acc + item.qty, 0);
    const summaryText = order.items
      .map((item) => (item.qty > 1 ? `${item.qty}× ${item.description}` : item.description))
      .join(", ");

    const isViewer = role === "VIEWER";

    return {
      id: order.id,
      number: order.number,
      kind,
      channel,
      status,
      version: order.version,
      customerId: order.customer?.id ?? null,
      customerName: order.customer?.name ?? null,
      customerPhone: order.customer?.phone ?? null,
      customerInstagram: order.customer?.instagram ?? null,
      itemsCount: totalPieces,
      itemsSummary: summaryText,
      dueDate: dueDateStr,
      isOverdue: overdue,
      total: isViewer ? null : order.total,
      expectedReceivable: isViewer ? null : expected,
      balance: isViewer ? null : balance,
      createdAt: order.createdAt,
      deliveredAt: order.deliveredAt,
    };
  });

  // Ordenar: 1) atrasados primero (por dueDate más antigua), 2) por número descendente
  mapped.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) {
      return a.isOverdue ? -1 : 1;
    }
    if (a.isOverdue && b.isOverdue && a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return b.number - a.number;
  });

  return mapped;
}

export type OrderDetailItem = {
  id: string;
  position: number;
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number | null;
  subtotal: number | null;
  material: string | null;
  grams: number | null;
  colorsCount: number;
};

export type OrderDetailEvent = {
  id: string;
  version: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorUserId: string;
  actorName: string;
  occurredAt: Date;
};

export type OrderDetailPayment = {
  id: string;
  type: string;
  category: string;
  amount: number | null;
  method: string;
  occurredOn: string;
  notes: string | null;
  createdAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
};

export type OrderDetail = {
  id: string;
  number: number;
  kind: OrderKind;
  channel: OrderChannel;
  status: OrderStatus;
  version: number;
  dueDate: string | null;
  isOverdue: boolean;
  notes: string | null;
  mlOrderRef: string | null;
  createdAt: Date;
  deliveredAt: Date | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    instagram: string | null;
  } | null;
  items: OrderDetailItem[];
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  mlCommission: number | null;
  mlShippingCost: number | null;
  expectedReceivable: number | null;
  paidAmount: number | null;
  balance: number | null;
  events: OrderDetailEvent[];
  transactions: OrderDetailPayment[];
};

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const { centerId, role, timeZone } = await requireAuthContext();
  if (!UUID_REGEX.test(orderId)) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: { centerId, id: orderId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          instagram: true,
        },
      },
      items: {
        orderBy: { position: "asc" },
      },
      events: {
        orderBy: { version: "asc" },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    return null;
  }

  const actorIds = Array.from(new Set(order.events.map((e) => e.actorUserId)));
  const members =
    actorIds.length > 0
      ? await prisma.centerMember.findMany({
          where: {
            centerId,
            userId: { in: actorIds },
          },
          include: {
            profile: {
              select: {
                displayName: true,
              },
            },
          },
        })
      : [];

  const actorNameByUserId = new Map<string, string>();
  for (const m of members) {
    actorNameByUserId.set(m.userId, m.profile?.displayName?.trim() || "Integrante del taller");
  }

  const tz = timeZone ?? "America/Santiago";
  const status = order.status as OrderStatus;
  const channel = order.channel as OrderChannel;
  const kind = order.kind as OrderKind;
  const dueDateStr = formatDateOnly(order.dueDate);
  const overdue = isOverdue({ dueDate: dueDateStr, status }, new Date(), tz);

  const subtotal = orderSubtotal(order.items);
  const expected = expectedReceivable({
    channel,
    total: order.total,
    mlCommission: order.mlCommission,
    mlShippingCost: order.mlShippingCost,
  });

  const incomePayments = order.transactions
    .filter((t) => t.type === "INCOME")
    .map((t) => ({
      amount: t.amount,
      voided: t.voidedAt !== null,
    }));

  const paidAmount = incomePayments.reduce(
    (sum, p) => sum + (p.voided ? 0 : p.amount),
    0
  );
  const balance = orderBalance(expected, incomePayments);

  const isViewer = role === "VIEWER";

  return {
    id: order.id,
    number: order.number,
    kind,
    channel,
    status,
    version: order.version,
    dueDate: dueDateStr,
    isOverdue: overdue,
    notes: order.notes,
    mlOrderRef: order.mlOrderRef,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          instagram: order.customer.instagram,
        }
      : null,
    items: order.items.map((item) => ({
      id: item.id,
      position: item.position,
      productId: item.productId,
      description: item.description,
      qty: item.qty,
      unitPrice: isViewer ? null : item.unitPrice,
      subtotal: isViewer ? null : item.qty * item.unitPrice,
      material: item.material,
      grams: item.grams,
      colorsCount: item.colorsCount,
    })),
    subtotal: isViewer ? null : subtotal,
    discount: isViewer ? null : order.discount,
    total: isViewer ? null : order.total,
    mlCommission: isViewer ? null : order.mlCommission,
    mlShippingCost: isViewer ? null : order.mlShippingCost,
    expectedReceivable: isViewer ? null : expected,
    paidAmount: isViewer ? null : paidAmount,
    balance: isViewer ? null : balance,
    events: order.events.map((ev) => ({
      id: ev.id,
      version: ev.version,
      fromStatus: (ev.fromStatus as OrderStatus | null) ?? null,
      toStatus: ev.toStatus as OrderStatus,
      actorUserId: ev.actorUserId,
      actorName: actorNameByUserId.get(ev.actorUserId) ?? "Integrante del taller",
      occurredAt: ev.occurredAt,
    })),
    transactions: order.transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      category: tx.category,
      amount: isViewer ? null : tx.amount,
      method: tx.method,
      occurredOn: formatDateOnly(tx.occurredOn) ?? "",
      notes: tx.notes,
      createdAt: tx.createdAt,
      voidedAt: tx.voidedAt,
      voidReason: tx.voidReason,
    })),
  };
}

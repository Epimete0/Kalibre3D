import { requireAuthContext } from "@/lib/auth";
import { isClosedStatus, type OrderChannel, type OrderStatus } from "@/lib/order-status";
import { expectedReceivable, orderBalance } from "@/lib/order-totals";
import { prisma } from "@/lib/prisma";

export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  ordersCount: number;
  totalSpent: number | null;
  pendingBalance: number | null;
};

export async function listCustomers(options?: {
  search?: string;
  includeInactive?: boolean;
}): Promise<CustomerListItem[]> {
  const { centerId, role } = await requireAuthContext();

  const customers = await prisma.customer.findMany({
    where: {
      centerId,
      ...(options?.includeInactive ? {} : { active: true }),
    },
    include: {
      _count: {
        select: { orders: true },
      },
      orders: {
        where: { centerId },
        select: {
          id: true,
          total: true,
          channel: true,
          status: true,
          mlCommission: true,
          mlShippingCost: true,
          transactions: {
            where: { centerId, type: "INCOME" },
            select: { amount: true, voidedAt: true },
          },
        },
      },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  const query = options?.search ? normalizeSearchText(options.search) : "";

  const filtered = query
    ? customers.filter((c) => {
        const nameNorm = normalizeSearchText(c.name);
        const phoneNorm = normalizeSearchText(c.phone ?? "");
        const instaNorm = normalizeSearchText(c.instagram ?? "");
        return nameNorm.includes(query) || phoneNorm.includes(query) || instaNorm.includes(query);
      })
    : customers;

  return filtered.map((c) => {
    let totalSpent = 0;
    let pendingBalance = 0;

    for (const order of c.orders) {
      if (order.status !== "CANCELED") {
        totalSpent += order.total;

        const receivable = expectedReceivable({
          channel: order.channel as OrderChannel,
          total: order.total,
          mlCommission: order.mlCommission,
          mlShippingCost: order.mlShippingCost,
        });

        const balance = orderBalance(
          receivable,
          order.transactions.map((t) => ({ amount: t.amount, voided: t.voidedAt !== null }))
        );

        if (!isClosedStatus(order.status as OrderStatus)) {
          pendingBalance += balance;
        }
      }
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      instagram: c.instagram,
      notes: c.notes,
      active: c.active,
      createdAt: c.createdAt,
      ordersCount: c._count.orders,
      totalSpent: role === "VIEWER" ? null : totalSpent,
      pendingBalance: role === "VIEWER" ? null : pendingBalance,
    };
  });
}

export type CustomerDetailOrder = {
  id: string;
  number: number;
  channel: string;
  status: string;
  total: number | null;
  balance: number | null;
  paid: number | null;
  dueDate: Date | null;
  createdAt: Date;
  itemsCount: number;
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
  notes: string | null;
  active: boolean;
  createdAt: Date;
  totalSpent: number | null;
  pendingBalance: number | null;
  orders: CustomerDetailOrder[];
};

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const { centerId, role } = await requireAuthContext();

  const customer = await prisma.customer.findFirst({
    where: { id, centerId },
    include: {
      orders: {
        where: { centerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          number: true,
          channel: true,
          status: true,
          total: true,
          mlCommission: true,
          mlShippingCost: true,
          dueDate: true,
          createdAt: true,
          _count: { select: { items: true } },
          transactions: {
            where: { centerId, type: "INCOME" },
            select: { amount: true, voidedAt: true },
          },
        },
      },
    },
  });

  if (!customer) return null;

  let totalSpent = 0;
  let pendingBalance = 0;

  const orders: CustomerDetailOrder[] = customer.orders.map((order) => {
    let orderPaid = 0;
    for (const t of order.transactions) {
      if (!t.voidedAt) {
        orderPaid += t.amount;
      }
    }

    const receivable = expectedReceivable({
      channel: order.channel as OrderChannel,
      total: order.total,
      mlCommission: order.mlCommission,
      mlShippingCost: order.mlShippingCost,
    });

    const balance = orderBalance(
      receivable,
      order.transactions.map((t) => ({ amount: t.amount, voided: t.voidedAt !== null }))
    );

    if (order.status !== "CANCELED") {
      totalSpent += order.total;
      if (!isClosedStatus(order.status as OrderStatus)) {
        pendingBalance += balance;
      }
    }

    return {
      id: order.id,
      number: order.number,
      channel: order.channel,
      status: order.status,
      total: role === "VIEWER" ? null : order.total,
      balance: role === "VIEWER" ? null : balance,
      paid: role === "VIEWER" ? null : orderPaid,
      dueDate: order.dueDate,
      createdAt: order.createdAt,
      itemsCount: order._count.items,
    };
  });

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    instagram: customer.instagram,
    notes: customer.notes,
    active: customer.active,
    createdAt: customer.createdAt,
    totalSpent: role === "VIEWER" ? null : totalSpent,
    pendingBalance: role === "VIEWER" ? null : pendingBalance,
    orders,
  };
}

export async function getCustomerById(id: string) {
  const { centerId } = await requireAuthContext();
  return prisma.customer.findFirst({
    where: { id, centerId },
  });
}

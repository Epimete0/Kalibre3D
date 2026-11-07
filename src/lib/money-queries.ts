import { requireCatalogContext } from "@/lib/auth";
import {
  currentMonth,
  isValidMonth,
  monthDateRange,
  monthlySummary,
  shiftMonth,
  todayInTimeZone,
  type MonthlySummary,
} from "@/lib/money-summary";
import { prisma } from "@/lib/prisma";

export type MoneyTransactionListItem = {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  method: string;
  occurredOn: string;
  notes: string | null;
  orderId: string | null;
  orderNumber: number | null;
  orderChannel: string | null;
  createdAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
};

export type MonthlyMoneyView = {
  month: string;
  previousMonth: string;
  nextMonth: string;
  todayStr: string;
  summary: MonthlySummary;
  transactions: MoneyTransactionListItem[];
};

export async function getMonthlyMoneyView(options?: {
  month?: string;
  now?: Date;
}): Promise<MonthlyMoneyView> {
  const { centerId, timeZone } = await requireCatalogContext();
  const tz = timeZone ?? "America/Santiago";
  const now = options?.now ?? new Date();

  const month =
    options?.month && isValidMonth(options.month)
      ? options.month
      : currentMonth(now, tz);

  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const todayStr = todayInTimeZone(now, tz);
  const { from, to } = monthDateRange(month);

  const rows = await prisma.moneyTransaction.findMany({
    where: {
      centerId,
      occurredOn: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
    },
    include: {
      order: {
        select: {
          id: true,
          number: true,
          channel: true,
        },
      },
    },
    orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
  });

  const summary = monthlySummary(
    rows.map((r) => ({
      type: r.type as "INCOME" | "EXPENSE",
      category: r.category,
      amount: r.amount,
      channel: r.order?.channel ?? null,
      voided: r.voidedAt !== null,
    }))
  );

  const transactions: MoneyTransactionListItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type as "INCOME" | "EXPENSE",
    category: r.category,
    amount: r.amount,
    method: r.method,
    occurredOn: r.occurredOn.toISOString().slice(0, 10),
    notes: r.notes,
    orderId: r.order?.id ?? r.orderId ?? null,
    orderNumber: r.order?.number ?? null,
    orderChannel: r.order?.channel ?? null,
    createdAt: r.createdAt,
    voidedAt: r.voidedAt,
    voidReason: r.voidReason,
  }));

  return {
    month,
    previousMonth,
    nextMonth,
    todayStr,
    summary,
    transactions,
  };
}

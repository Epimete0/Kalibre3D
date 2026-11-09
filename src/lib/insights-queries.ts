/**
 * Consultas de Compras y Rentabilidad (pestañas de Dinero). Solo Dueño/Administrador (requireCatalogContext)
 * y siempre filtradas por el taller activo.
 */
import { requireCatalogContext } from "@/lib/auth";
import { aggregateProfitability, summarizePurchases, type ProductProfitability, type PurchasesSummary } from "@/lib/insights";
import { currentMonth, isValidMonth, monthDateRange, shiftMonth, todayInTimeZone } from "@/lib/money-summary";
import { prisma } from "@/lib/prisma";
import { estimateUnitCost, type CostRates } from "@/lib/sale-cost";

export type MonthNavigation = { month: string; previousMonth: string; nextMonth: string };

function resolveMonth(requested: string | undefined, timeZone: string): MonthNavigation {
  const month = requested && isValidMonth(requested) ? requested : currentMonth(new Date(), timeZone);
  return { month, previousMonth: shiftMonth(month, -1), nextMonth: shiftMonth(month, 1) };
}

export type PurchasesView = MonthNavigation & { summary: PurchasesSummary };

export async function getMonthlyPurchases(options?: { month?: string }): Promise<PurchasesView> {
  const { centerId, timeZone } = await requireCatalogContext();
  const nav = resolveMonth(options?.month, timeZone ?? "America/Santiago");
  const { from, to } = monthDateRange(nav.month);
  const range = { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T00:00:00.000Z`) };

  const [expenses, spools] = await Promise.all([
    prisma.moneyTransaction.findMany({
      where: { centerId, type: "EXPENSE", occurredOn: range },
      select: { id: true, category: true, amount: true, occurredOn: true, notes: true, voidedAt: true },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
    }),
    prisma.spool.findMany({
      where: { centerId, purchasedOn: range },
      select: { totalGrams: true, pricePaid: true },
    }),
  ]);

  return {
    ...nav,
    summary: summarizePurchases(
      expenses.map((row) => ({
        id: row.id,
        category: row.category,
        amount: row.amount,
        occurredOn: row.occurredOn.toISOString().slice(0, 10),
        notes: row.notes,
        voided: row.voidedAt !== null,
      })),
      spools
    ),
  };
}

export type ProfitabilityView = {
  period: "month" | "all";
  nav: MonthNavigation;
  rows: ProductProfitability[];
  totals: { revenue: number; cost: number; profit: number; units: number };
  ordersCount: number;
};

/** Pedidos que cuentan como venta: confirmados en adelante, sin cancelados ni devueltos. */
const SOLD_STATUSES = ["CONFIRMED", "PRINTING", "READY", "DELIVERED"];

export async function getProductProfitability(options?: { month?: string; all?: boolean }): Promise<ProfitabilityView> {
  const { centerId, timeZone } = await requireCatalogContext();
  const tz = timeZone ?? "America/Santiago";
  const nav = resolveMonth(options?.month, tz);
  const period = options?.all ? "all" : "month";

  const [orders, settings, spools] = await Promise.all([
    prisma.order.findMany({
      where: { centerId, status: { in: SOLD_STATUSES } },
      select: {
        id: true,
        createdAt: true,
        discount: true,
        mlCommission: true,
        mlShippingCost: true,
        items: {
          select: {
            productId: true,
            description: true,
            qty: true,
            unitPrice: true,
            unitCost: true,
            material: true,
            grams: true,
            colorsCount: true,
            product: { select: { name: true, material: true, grams: true, printMinutes: true, colorsCount: true, purgeGrams: true } },
          },
        },
      },
    }),
    prisma.centerSettings.findUnique({
      where: { centerId },
      select: { defaultCostPerKg: true, electricityCostPerHour: true, defaultPackagingCost: true, defaultPurgeGrams: true },
    }),
    prisma.spool.findMany({ where: { centerId, active: true }, select: { material: true, active: true, totalGrams: true, pricePaid: true } }),
  ]);

  // El mes de cada venta es el día local del taller en que se registró.
  const inPeriod = period === "all" ? orders : orders.filter((order) => todayInTimeZone(order.createdAt, tz).startsWith(nav.month));

  const rates: CostRates = {
    spools,
    defaultCostPerKg: settings?.defaultCostPerKg ?? 15000,
    electricityCostPerHour: settings?.electricityCostPerHour ?? 0,
    packagingCost: settings?.defaultPackagingCost ?? 0,
    defaultPurgeGrams: settings?.defaultPurgeGrams ?? 0,
  };

  const lines = inPeriod.flatMap((order) =>
    order.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      productName: item.product?.name ?? item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      currentUnitCost:
        item.unitCost !== null
          ? null
          : item.product
            ? estimateUnitCost(item.product, rates)
            : estimateUnitCost({ material: item.material, grams: item.grams, colorsCount: item.colorsCount }, rates),
    }))
  );
  const rows = aggregateProfitability(lines, inPeriod);
  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      profit: acc.profit + row.profit,
      units: acc.units + row.units,
    }),
    { revenue: 0, cost: 0, profit: 0, units: 0 }
  );

  return { period, nav, rows, totals, ordersCount: inPeriod.length };
}

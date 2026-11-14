/**
 * Consultas de Compras, Rentabilidad y Economía de ventas. Solo Dueño/Administrador (requireCatalogContext)
 * y siempre filtradas por el taller activo.
 */
import { requireCatalogContext } from "@/lib/auth";
import {
  aggregateProductPerformance,
  aggregateProfitability,
  computeOrderEconomics,
  computeSalesEconomicsSummary,
  summarizePurchases,
  type OrderEconomics,
  type ProductPerformanceSummary,
  type ProductProfitability,
  type PurchasesSummary,
  type SalesEconomicsSummary,
} from "@/lib/insights";
import { currentMonth, isValidMonth, monthDateRange, shiftMonth, todayInTimeZone } from "@/lib/money-summary";
import type { OrderChannel } from "@/lib/order-status";
import { expectedReceivable } from "@/lib/order-totals";
import { prisma } from "@/lib/prisma";
import { estimateUnitCost, type CostRates } from "@/lib/sale-cost";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

type ItemCostFields = {
  unitCost: number | null;
  material: string | null;
  grams: number | null;
  colorsCount: number;
  product: {
    material: string | null;
    grams: number | null;
    printMinutes: number | null;
    colorsCount: number | null;
    purgeGrams: number | null;
  } | null;
};

async function loadCostRatesAndVat(centerId: string): Promise<{ rates: CostRates; vatPercent: number }> {
  const [settings, spools] = await Promise.all([
    prisma.centerSettings.findUnique({
      where: { centerId },
      select: {
        defaultCostPerKg: true,
        electricityCostPerHour: true,
        defaultPackagingCost: true,
        defaultPurgeGrams: true,
        vatPercent: true,
      },
    }),
    prisma.spool.findMany({
      where: { centerId, active: true },
      select: { material: true, active: true, totalGrams: true, pricePaid: true },
    }),
  ]);

  return {
    rates: {
      spools,
      defaultCostPerKg: settings?.defaultCostPerKg ?? 15000,
      electricityCostPerHour: settings?.electricityCostPerHour ?? 0,
      packagingCost: settings?.defaultPackagingCost ?? 0,
      defaultPurgeGrams: settings?.defaultPurgeGrams ?? 0,
    },
    vatPercent: Number(settings?.vatPercent ?? 0),
  };
}

function resolveFallbackUnitCost(item: ItemCostFields, rates: CostRates): number | null {
  if (item.unitCost !== null) return null;
  return item.product
    ? estimateUnitCost(item.product, rates)
    : estimateUnitCost({ material: item.material, grams: item.grams, colorsCount: item.colorsCount }, rates);
}

export async function getProductProfitability(options?: { month?: string; all?: boolean }): Promise<ProfitabilityView> {
  const { centerId, timeZone } = await requireCatalogContext();
  const tz = timeZone ?? "America/Santiago";
  const nav = resolveMonth(options?.month, tz);
  const period = options?.all ? "all" : "month";

  const [orders, { rates }] = await Promise.all([
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
    loadCostRatesAndVat(centerId),
  ]);

  // El mes de cada venta es el día local del taller en que se registró.
  const inPeriod = period === "all" ? orders : orders.filter((order) => todayInTimeZone(order.createdAt, tz).startsWith(nav.month));

  const lines = inPeriod.flatMap((order) =>
    order.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      productName: item.product?.name ?? item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      currentUnitCost: resolveFallbackUnitCost(item, rates),
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

export type MonthlySalesEconomicsView = {
  nav: MonthNavigation;
  summary: SalesEconomicsSummary;
};

/** Resumen mensual de ventas, costo de fabricación de lo vendido y ganancia real para Dinero/Dashboard. */
export async function getMonthlySalesEconomics(options?: { month?: string }): Promise<MonthlySalesEconomicsView> {
  const { centerId, timeZone } = await requireCatalogContext();
  const tz = timeZone ?? "America/Santiago";
  const nav = resolveMonth(options?.month, tz);

  const [orders, { rates, vatPercent }] = await Promise.all([
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
    loadCostRatesAndVat(centerId),
  ]);

  const inPeriod = orders.filter((order) => todayInTimeZone(order.createdAt, tz).startsWith(nav.month));
  const lines = inPeriod.flatMap((order) =>
    order.items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      productName: item.product?.name ?? item.description,
      qty: item.qty,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      currentUnitCost: resolveFallbackUnitCost(item, rates),
    }))
  );
  const rows = aggregateProfitability(lines, inPeriod);

  return {
    nav,
    summary: computeSalesEconomicsSummary({
      rows,
      ordersCount: inPeriod.length,
      vatPercent,
    }),
  };
}

/** Costo de fabricación, IVA y ganancia estimada de un pedido individual (solo Dueño/Admin). */
export async function getOrderEconomics(orderId: string): Promise<OrderEconomics | null> {
  const { centerId } = await requireCatalogContext();
  if (!UUID_REGEX.test(orderId)) return null;

  const [order, { rates, vatPercent }] = await Promise.all([
    prisma.order.findFirst({
      where: { centerId, id: orderId },
      select: {
        channel: true,
        total: true,
        mlCommission: true,
        mlShippingCost: true,
        items: {
          select: {
            id: true,
            qty: true,
            unitCost: true,
            material: true,
            grams: true,
            colorsCount: true,
            product: {
              select: {
                material: true,
                grams: true,
                printMinutes: true,
                colorsCount: true,
                purgeGrams: true,
              },
            },
          },
        },
      },
    }),
    loadCostRatesAndVat(centerId),
  ]);

  if (!order) return null;

  const receivable = expectedReceivable({
    channel: order.channel as OrderChannel,
    total: order.total,
    mlCommission: order.mlCommission,
    mlShippingCost: order.mlShippingCost,
  });

  return computeOrderEconomics({
    expectedReceivable: receivable,
    vatPercent,
    items: order.items.map((item) => ({
      id: item.id,
      qty: item.qty,
      unitCost: item.unitCost,
      currentUnitCost: resolveFallbackUnitCost(item, rates),
    })),
  });
}

export type ProductPerformanceView = {
  period: "month" | "all";
  nav: MonthNavigation;
  vatPercent: number;
  summary: ProductPerformanceSummary;
};

/** Rendimiento real (ventas, costos, margen e historial de pedidos) de una pieza del catálogo. */
export async function getProductPerformance(
  productId: string,
  options?: { month?: string; all?: boolean }
): Promise<ProductPerformanceView | null> {
  const { centerId, timeZone } = await requireCatalogContext();
  if (!UUID_REGEX.test(productId)) return null;

  const tz = timeZone ?? "America/Santiago";
  const nav = resolveMonth(options?.month, tz);
  const period = options?.all ? "all" : "month";

  const [orders, { rates, vatPercent }] = await Promise.all([
    prisma.order.findMany({
      where: {
        centerId,
        status: { in: SOLD_STATUSES },
        items: { some: { productId } },
      },
      select: {
        id: true,
        number: true,
        channel: true,
        createdAt: true,
        discount: true,
        mlCommission: true,
        mlShippingCost: true,
        items: {
          select: {
            productId: true,
            qty: true,
            unitPrice: true,
            unitCost: true,
            material: true,
            grams: true,
            colorsCount: true,
            product: {
              select: {
                material: true,
                grams: true,
                printMinutes: true,
                colorsCount: true,
                purgeGrams: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    loadCostRatesAndVat(centerId),
  ]);

  const inPeriod =
    period === "all"
      ? orders
      : orders.filter((order) => todayInTimeZone(order.createdAt, tz).startsWith(nav.month));

  const summary = aggregateProductPerformance({
    productId,
    vatPercent,
    orders: inPeriod.map((order) => ({
      id: order.id,
      number: order.number,
      channel: order.channel,
      createdAt: order.createdAt,
      discount: order.discount,
      mlCommission: order.mlCommission,
      mlShippingCost: order.mlShippingCost,
      items: order.items.map((item) => ({
        productId: item.productId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        currentUnitCost: resolveFallbackUnitCost(item, rates),
      })),
    })),
  });

  return {
    period,
    nav,
    vatPercent,
    summary,
  };
}

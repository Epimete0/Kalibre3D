/**
 * Compras del mes y rentabilidad por pieza. Módulo puro: recibe filas ya filtradas por taller y calcula.
 * Montos enteros en la unidad mínima de la moneda del taller.
 */
import { vatIncluded } from "./costing";
import type { ExpenseCategory } from "./money-presentation";

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

export type PurchaseRow = {
  id: string;
  category: string;
  amount: number;
  occurredOn: string;
  notes: string | null;
  voided: boolean;
};

export type SpoolAddedRow = { totalGrams: number; pricePaid: number };

export type PurchasesSummary = {
  total: number;
  byCategory: Array<{ category: ExpenseCategory | string; total: number; count: number }>;
  purchases: PurchaseRow[];
  spoolsAdded: { count: number; grams: number; averagePerKg: number | null };
};

/** Las devoluciones son gastos pero no compras: no entran en esta vista. Lo anulado tampoco suma. */
const NOT_A_PURCHASE = new Set(["REFUNDS"]);

export function summarizePurchases(rows: readonly PurchaseRow[], spoolsAdded: readonly SpoolAddedRow[]): PurchasesSummary {
  const purchases = rows.filter((row) => !NOT_A_PURCHASE.has(row.category));
  const valid = purchases.filter((row) => !row.voided);
  const totals = new Map<string, { total: number; count: number }>();
  for (const row of valid) {
    const current = totals.get(row.category) ?? { total: 0, count: 0 };
    totals.set(row.category, { total: current.total + row.amount, count: current.count + 1 });
  }
  const grams = spoolsAdded.reduce((sum, spool) => sum + spool.totalGrams, 0);
  const paid = spoolsAdded.reduce((sum, spool) => sum + spool.pricePaid, 0);
  return {
    total: valid.reduce((sum, row) => sum + row.amount, 0),
    byCategory: [...totals.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.total - a.total),
    purchases,
    spoolsAdded: {
      count: spoolsAdded.length,
      grams,
      averagePerKg: grams > 0 ? Math.round((paid * 1000) / grams) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Rentabilidad por pieza
// ---------------------------------------------------------------------------

export type SaleLine = {
  orderId: string;
  productId: string | null;
  productName: string | null;
  qty: number;
  unitPrice: number;
  /** Costo guardado al vender; null si no se pudo calcular o la venta es anterior. */
  unitCost: number | null;
  /** Costo estimado con las tarifas actuales (para ventas sin costo guardado); null si no hay datos. */
  currentUnitCost: number | null;
};

export type SaleOrder = {
  id: string;
  /** Lo que se resta del total por pedido: descuento, comisión y envío de Mercado Libre. */
  discount: number;
  mlCommission: number;
  mlShippingCost: number;
};

export type ProductProfitability = {
  key: string;
  productId: string | null;
  name: string;
  units: number;
  /** Lo que realmente entró: precio menos descuento y cargos de Mercado Libre, repartidos por línea. */
  revenue: number;
  cost: number;
  profit: number;
  /** Ganancia sobre ingresos, en porcentaje entero; null sin ingresos. */
  marginPercent: number | null;
  /** Unidades cuyo costo no se pudo calcular (no se suman al costo). */
  unitsWithoutCost: number;
  /** Unidades cuyo costo se estimó con las tarifas de hoy (ventas sin costo guardado). */
  unitsEstimatedToday: number;
};

export const OTHER_SALES_KEY = "otras-ventas";

export function aggregateProfitability(lines: readonly SaleLine[], orders: readonly SaleOrder[]): ProductProfitability[] {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const subtotalByOrder = new Map<string, number>();
  for (const line of lines) {
    subtotalByOrder.set(line.orderId, (subtotalByOrder.get(line.orderId) ?? 0) + line.qty * line.unitPrice);
  }

  const groups = new Map<string, ProductProfitability>();
  for (const line of lines) {
    const key = line.productId ?? OTHER_SALES_KEY;
    const group =
      groups.get(key) ??
      ({
        key,
        productId: line.productId,
        name: line.productId ? (line.productName ?? "Pieza del catálogo") : "Otras ventas (escritas a mano)",
        units: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        marginPercent: null,
        unitsWithoutCost: 0,
        unitsEstimatedToday: 0,
      } satisfies ProductProfitability);

    const lineSubtotal = line.qty * line.unitPrice;
    const order = orderById.get(line.orderId);
    const orderSubtotal = subtotalByOrder.get(line.orderId) ?? 0;
    const deductions = order ? order.discount + order.mlCommission + order.mlShippingCost : 0;
    const share = orderSubtotal > 0 ? Math.round((deductions * lineSubtotal) / orderSubtotal) : 0;

    group.units += line.qty;
    group.revenue += lineSubtotal - share;

    const unitCost = line.unitCost ?? line.currentUnitCost;
    if (unitCost === null) {
      group.unitsWithoutCost += line.qty;
    } else {
      group.cost += unitCost * line.qty;
      if (line.unitCost === null) group.unitsEstimatedToday += line.qty;
    }
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => {
      const profit = group.revenue - group.cost;
      return {
        ...group,
        profit,
        marginPercent: group.revenue > 0 ? Math.round((profit / group.revenue) * 100) : null,
      };
    })
    // Piezas del catálogo de mayor a menor ganancia; "Otras ventas" siempre al final, porque sin costo
    // calculado su ganancia aparece inflada y no es una pieza que se pueda empujar.
    .sort((a, b) => Number(a.key === OTHER_SALES_KEY) - Number(b.key === OTHER_SALES_KEY) || b.profit - a.profit);
}

// ---------------------------------------------------------------------------
// Resumen económico de ventas, por pedido y por producto
// ---------------------------------------------------------------------------

export type SalesEconomicsSummary = {
  grossRevenue: number;
  vatAmount: number;
  netRevenue: number;
  productionCost: number;
  netProfit: number;
  marginPercent: number | null;
  units: number;
  ordersCount: number;
  unitsWithoutCost: number;
  unitsEstimatedToday: number;
};

/** Resume ingresos netos de ML/descuentos, IVA incluido, costo de fabricación y ganancia real del período. */
export function computeSalesEconomicsSummary(input: {
  rows: readonly ProductProfitability[];
  ordersCount: number;
  vatPercent: number;
}): SalesEconomicsSummary {
  let grossRevenue = 0;
  let productionCost = 0;
  let units = 0;
  let unitsWithoutCost = 0;
  let unitsEstimatedToday = 0;

  for (const row of input.rows) {
    grossRevenue += row.revenue;
    productionCost += row.cost;
    units += row.units;
    unitsWithoutCost += row.unitsWithoutCost;
    unitsEstimatedToday += row.unitsEstimatedToday;
  }

  const vatAmount = vatIncluded(grossRevenue, input.vatPercent);
  const netRevenue = grossRevenue - vatAmount;
  const netProfit = netRevenue - productionCost;
  const marginPercent = netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : null;

  return {
    grossRevenue,
    vatAmount,
    netRevenue,
    productionCost,
    netProfit,
    marginPercent,
    units,
    ordersCount: input.ordersCount,
    unitsWithoutCost,
    unitsEstimatedToday,
  };
}

export type OrderEconomicsItemInput = {
  id: string;
  qty: number;
  unitCost: number | null;
  currentUnitCost: number | null;
};

export type OrderEconomicsItemResult = {
  id: string;
  unitCost: number | null;
  totalCost: number | null;
  source: "stored" | "estimated" | "unknown";
};

export type OrderEconomics = {
  expectedReceivable: number;
  vatAmount: number;
  netRevenue: number;
  productionCost: number;
  profit: number;
  marginPercent: number | null;
  units: number;
  unitsWithoutCost: number;
  unitsEstimatedToday: number;
  itemsById: Record<string, OrderEconomicsItemResult>;
};

/** Calcula el costo de fabricación, IVA y ganancia estimada de un pedido individual. */
export function computeOrderEconomics(input: {
  expectedReceivable: number;
  vatPercent: number;
  items: readonly OrderEconomicsItemInput[];
}): OrderEconomics {
  let productionCost = 0;
  let units = 0;
  let unitsWithoutCost = 0;
  let unitsEstimatedToday = 0;
  const itemsById: Record<string, OrderEconomicsItemResult> = {};

  for (const item of input.items) {
    units += item.qty;
    const resolvedUnit = item.unitCost ?? item.currentUnitCost;
    if (resolvedUnit === null) {
      unitsWithoutCost += item.qty;
      itemsById[item.id] = { id: item.id, unitCost: null, totalCost: null, source: "unknown" };
    } else {
      const totalCost = resolvedUnit * item.qty;
      productionCost += totalCost;
      const source = item.unitCost !== null ? "stored" : "estimated";
      if (source === "estimated") unitsEstimatedToday += item.qty;
      itemsById[item.id] = { id: item.id, unitCost: resolvedUnit, totalCost, source };
    }
  }

  const vatAmount = vatIncluded(input.expectedReceivable, input.vatPercent);
  const netRevenue = input.expectedReceivable - vatAmount;
  const profit = netRevenue - productionCost;
  const marginPercent = netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : null;

  return {
    expectedReceivable: input.expectedReceivable,
    vatAmount,
    netRevenue,
    productionCost,
    profit,
    marginPercent,
    units,
    unitsWithoutCost,
    unitsEstimatedToday,
    itemsById,
  };
}

export type ProductPerformanceOrderInput = {
  id: string;
  number: number;
  channel: string;
  createdAt: Date;
  discount: number;
  mlCommission: number;
  mlShippingCost: number;
  items: readonly {
    productId: string | null;
    qty: number;
    unitPrice: number;
    unitCost: number | null;
    currentUnitCost: number | null;
  }[];
};

export type ProductPerformanceOrderRow = {
  orderId: string;
  orderNumber: number;
  channel: string;
  createdAt: Date;
  qty: number;
  grossRevenue: number;
  netRevenue: number;
  cost: number;
  profit: number;
  hasMissingCost: boolean;
};

export type ProductPerformanceSummary = {
  units: number;
  ordersCount: number;
  grossRevenue: number;
  vatAmount: number;
  netRevenue: number;
  productionCost: number;
  profit: number;
  marginPercent: number | null;
  unitsWithoutCost: number;
  unitsEstimatedToday: number;
  recentOrders: ProductPerformanceOrderRow[];
};

/** Agrega ventas, costos y margen real de un producto del catálogo con sus pedidos recientes. */
export function aggregateProductPerformance(input: {
  productId: string;
  vatPercent: number;
  orders: readonly ProductPerformanceOrderInput[];
}): ProductPerformanceSummary {
  let units = 0;
  let grossRevenue = 0;
  let productionCost = 0;
  let unitsWithoutCost = 0;
  let unitsEstimatedToday = 0;
  const recentOrders: ProductPerformanceOrderRow[] = [];

  for (const order of input.orders) {
    const matching = order.items.filter((item) => item.productId === input.productId);
    if (matching.length === 0) continue;

    const orderSubtotal = order.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const lineSubtotal = matching.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const deductions =
      order.discount + (order.channel === "MERCADOLIBRE" ? order.mlCommission + order.mlShippingCost : 0);
    const share = orderSubtotal > 0 ? Math.round((deductions * lineSubtotal) / orderSubtotal) : 0;

    const orderGross = lineSubtotal - share;
    const orderVat = vatIncluded(orderGross, input.vatPercent);
    const orderNet = orderGross - orderVat;

    let orderQty = 0;
    let orderCost = 0;
    let hasMissingCost = false;

    for (const item of matching) {
      orderQty += item.qty;
      const resolvedUnit = item.unitCost ?? item.currentUnitCost;
      if (resolvedUnit === null) {
        unitsWithoutCost += item.qty;
        hasMissingCost = true;
      } else {
        orderCost += resolvedUnit * item.qty;
        if (item.unitCost === null) unitsEstimatedToday += item.qty;
      }
    }

    units += orderQty;
    grossRevenue += orderGross;
    productionCost += orderCost;

    recentOrders.push({
      orderId: order.id,
      orderNumber: order.number,
      channel: order.channel,
      createdAt: order.createdAt,
      qty: orderQty,
      grossRevenue: orderGross,
      netRevenue: orderNet,
      cost: orderCost,
      profit: orderNet - orderCost,
      hasMissingCost,
    });
  }

  recentOrders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const vatAmount = vatIncluded(grossRevenue, input.vatPercent);
  const netRevenue = grossRevenue - vatAmount;
  const profit = netRevenue - productionCost;
  const marginPercent = netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : null;

  return {
    units,
    ordersCount: recentOrders.length,
    grossRevenue,
    vatAmount,
    netRevenue,
    productionCost,
    profit,
    marginPercent,
    unitsWithoutCost,
    unitsEstimatedToday,
    recentOrders,
  };
}

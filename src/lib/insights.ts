/**
 * Compras del mes y rentabilidad por pieza. Módulo puro: recibe filas ya filtradas por taller y calcula.
 * Montos enteros en la unidad mínima de la moneda del taller.
 */
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

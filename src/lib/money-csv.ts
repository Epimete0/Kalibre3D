import type { MonthlyOrderAccountRow } from "./insights";
import { currencyDecimals } from "./money-format";
import { CATEGORY_LABEL, METHOD_LABEL, type MoneyCategory, type PaymentMethod } from "./money-presentation";
import type { MonthlyMoneyView } from "./money-queries";
import { CHANNEL_LABEL, orderNumberLabel } from "./order-presentation";
import type { OrderChannel } from "./order-status";

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/**
 * Neutraliza posibles inyecciones de fórmulas en Excel / LibreOffice / Google Sheets
 * (OWASP CSV Injection) anteponiendo un apóstrofo cuando un texto libre inicia con =, +, -, @, tab o CR.
 */
export function sanitizeCsvText(value: string): string {
  const trimmed = value.replace(/\r?\n/g, " ").trim();
  if (!trimmed) return "";
  return FORMULA_PREFIX_RE.test(trimmed) ? `'${trimmed}` : trimmed;
}

/**
 * Escapa una celda para CSV separado por punto y coma (;), estándar en Excel en español.
 */
export function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  if (raw.includes(";") || raw.includes('"') || raw.includes("\n") || raw.includes("\r") || raw.includes(",")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Convierte un monto en unidades mínimas a unidades mayores para planilla (ej. CLP 8990 -> "8990", USD 1250 -> "12.50").
 */
export function formatCsvAmount(minorUnits: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  if (decimals === 0) {
    return String(Math.round(minorUnits));
  }
  const factor = 10 ** decimals;
  return (minorUnits / factor).toFixed(decimals);
}

export function moneyCsvFilename(month: string): string {
  return `kalibre-movimientos-${month}.csv`;
}

export function accountsCsvFilename(month: string): string {
  return `kalibre-cuentas-${month}.csv`;
}

/**
 * Construye el archivo CSV (con BOM UTF-8 para que Excel en Windows reconozca tildes y eñes)
 * con todos los movimientos del mes.
 */
export function buildMonthlyMoneyCsv(view: MonthlyMoneyView, currency: string): string {
  const headers = [
    "Fecha",
    "Tipo",
    "Categoría",
    "Canal",
    "Pedido",
    "Método de pago",
    "Monto",
    "Monto con signo",
    "Moneda",
    "Estado",
    "Notas",
    "Motivo de anulación",
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(";")];

  for (const tx of view.transactions) {
    const isVoided = tx.voidedAt !== null;
    const typeLabel = tx.type === "INCOME" ? "Ingreso" : "Gasto";
    const categoryLabel = CATEGORY_LABEL[tx.category as MoneyCategory] ?? tx.category;
    const channelLabel = tx.orderChannel
      ? (CHANNEL_LABEL[tx.orderChannel as OrderChannel] ?? tx.orderChannel)
      : "";
    const orderLabel = tx.orderNumber !== null ? orderNumberLabel(tx.orderNumber) : "";
    const methodLabel = METHOD_LABEL[tx.method as PaymentMethod] ?? tx.method;
    const unsignedAmount = formatCsvAmount(tx.amount, currency);
    const signedMinor = isVoided ? 0 : tx.type === "EXPENSE" ? -tx.amount : tx.amount;
    const signedAmount = formatCsvAmount(signedMinor, currency);
    const statusLabel = isVoided ? "Anulado" : "Vigente";
    const notesSafe = tx.notes ? sanitizeCsvText(tx.notes) : "";
    const voidReasonSafe = tx.voidReason ? sanitizeCsvText(tx.voidReason) : "";

    const row = [
      tx.occurredOn,
      typeLabel,
      categoryLabel,
      channelLabel,
      orderLabel,
      methodLabel,
      unsignedAmount,
      signedAmount,
      currency,
      statusLabel,
      notesSafe,
      voidReasonSafe,
    ];

    lines.push(row.map(escapeCsvCell).join(";"));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Construye el CSV de cuentas del mes (utilidades, IVA y costos por pedido) compatible con Excel en español.
 */
export function buildMonthlyAccountsCsv(
  orders: readonly MonthlyOrderAccountRow[],
  currency: string,
  vatPercent: number
): string {
  const headers = [
    "Fecha",
    "Pedido",
    "Canal",
    "Cliente",
    "Piezas",
    "Unidades",
    "Venta neta ML/desc",
    `IVA (${vatPercent}%)`,
    "Neto taller",
    "Costo fabricación",
    "Utilidad estimada",
    "Margen (%)",
    "Moneda",
    "Observación de costo",
  ];

  const lines: string[] = [headers.map(escapeCsvCell).join(";")];

  let totalUnits = 0;
  let totalGross = 0;
  let totalVat = 0;
  let totalNet = 0;
  let totalCost = 0;
  let totalProfit = 0;

  for (const row of orders) {
    totalUnits += row.units;
    totalGross += row.grossRevenue;
    totalVat += row.vatAmount;
    totalNet += row.netRevenue;
    totalCost += row.productionCost;
    totalProfit += row.profit;

    const costNote =
      row.unitsWithoutCost > 0
        ? "Costo incompleto (faltan gramos/material)"
        : row.unitsEstimatedToday > 0
          ? "Estimado con tarifas actuales"
          : "Costo registrado al vender";

    const cells = [
      row.createdOn,
      orderNumberLabel(row.number),
      CHANNEL_LABEL[row.channel] ?? row.channel,
      row.customerName ? sanitizeCsvText(row.customerName) : "",
      sanitizeCsvText(row.itemsSummary),
      row.units,
      formatCsvAmount(row.grossRevenue, currency),
      formatCsvAmount(row.vatAmount, currency),
      formatCsvAmount(row.netRevenue, currency),
      formatCsvAmount(row.productionCost, currency),
      formatCsvAmount(row.profit, currency),
      row.marginPercent !== null ? `${row.marginPercent}%` : "",
      currency,
      costNote,
    ];
    lines.push(cells.map(escapeCsvCell).join(";"));
  }

  if (orders.length > 0) {
    const totalMargin = totalNet > 0 ? `${Math.round((totalProfit / totalNet) * 100)}%` : "";
    const totalsRow = [
      "TOTAL",
      `${orders.length} pedido(s)`,
      "",
      "",
      "",
      totalUnits,
      formatCsvAmount(totalGross, currency),
      formatCsvAmount(totalVat, currency),
      formatCsvAmount(totalNet, currency),
      formatCsvAmount(totalCost, currency),
      formatCsvAmount(totalProfit, currency),
      totalMargin,
      currency,
      "",
    ];
    lines.push(totalsRow.map(escapeCsvCell).join(";"));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

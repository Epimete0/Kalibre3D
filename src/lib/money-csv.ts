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

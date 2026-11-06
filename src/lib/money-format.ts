/** Monedas del taller y montos en unidad mínima (onyx.md D9). Módulo puro. */

export const CURRENCIES = ["CLP", "ARS", "MXN", "COP", "PEN", "UYU", "BOB", "PYG", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABEL: Record<Currency, string> = {
  CLP: "Peso chileno (CLP)",
  ARS: "Peso argentino (ARS)",
  MXN: "Peso mexicano (MXN)",
  COP: "Peso colombiano (COP)",
  PEN: "Sol peruano (PEN)",
  UYU: "Peso uruguayo (UYU)",
  BOB: "Boliviano (BOB)",
  PYG: "Guaraní (PYG)",
  USD: "Dólar estadounidense (USD)",
  EUR: "Euro (EUR)",
};

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/** Decimales de la moneda según ISO 4217 (CLP y PYG: 0; el resto: 2). */
export function currencyDecimals(currency: string): number {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 0;
}

/** Formatea un monto en unidad mínima, por ejemplo 8990 CLP → "$8.990". */
export function formatMoney(minorUnits: number, currency: string = "CLP"): string {
  const decimals = currencyDecimals(currency);
  return new Intl.NumberFormat("es-CL", { style: "currency", currency }).format(minorUnits / 10 ** decimals);
}

/**
 * Convierte lo que escribe la persona ("8.990", "12,5") a unidad mínima.
 * En monedas sin decimales el punto se toma como separador de miles. Devuelve null si no es un monto válido (≥ 0).
 */
export function toMinorUnits(input: string, currency: string = "CLP"): number | null {
  const decimals = currencyDecimals(currency);
  const raw = input.trim().replace(/\s/g, "");
  if (!raw) return null;
  const normalized = decimals === 0 ? raw.replace(/[.,]/g, "") : raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Math.round(Number(normalized) * 10 ** decimals);
  return Number.isSafeInteger(value) ? value : null;
}

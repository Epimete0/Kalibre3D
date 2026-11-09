/**
 * Fechas y meses en lenguaje normal para la interfaz ("7 nov 2026", "noviembre 2026").
 * Reciben fechas de calendario ya resueltas en la zona del taller (AAAA-MM-DD o AAAA-MM), así que no
 * dependen de la zona horaria del navegador ni del servidor.
 */

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"] as const;

/** "2026-11" → "noviembre 2026". Si no es un mes válido, lo devuelve tal cual. */
export function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const name = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && name ? `${name} ${match[1]}` : month;
}

/** "2026-11" → "noviembre" (para flechas de navegación entre meses). */
export function formatMonthName(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  return (match && MONTHS[Number(match[2]) - 1]) || month;
}

/** "2026-11-07" → "7 nov 2026". Si no es una fecha válida, la devuelve tal cual. */
export function formatDay(date: string | null | undefined): string {
  if (!date) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const short = match ? MONTHS_SHORT[Number(match[2]) - 1] : undefined;
  return match && short ? `${Number(match[3])} ${short} ${match[1]}` : date;
}

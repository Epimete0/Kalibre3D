/**
 * Helpers puros para formateo automático de montos enteros con separador de miles (`.` en locale es-CL)
 * mientras el usuario escribe, manteniendo el estado subyacente como string numérico limpio (`"10000"`).
 */

/** Extrae solo dígitos ASCII de un texto ingresado o pegado. */
export function parseMoneyDigits(raw: string): string {
  return raw.replace(/\D+/g, "");
}

/** Formatea una cadena de dígitos con separador de miles `.` (ej. `"10000"` → `"10.000"`). */
export function formatThousands(digitsOrNumber: string | number): string {
  const digits =
    typeof digitsOrNumber === "number"
      ? Number.isFinite(digitsOrNumber) && digitsOrNumber >= 0
        ? String(Math.round(digitsOrNumber))
        : ""
      : parseMoneyDigits(digitsOrNumber);
  if (!digits) return "";
  const trimmed = digits.replace(/^0+(?=\d)/, "");
  return trimmed.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Convierte una cadena de dígitos (o formateada) a entero no negativo. */
export function digitsToInt(raw: string): number {
  const digits = parseMoneyDigits(raw);
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

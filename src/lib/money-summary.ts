/** Resumen mensual de dinero y fechas en la zona del taller (onyx.md D5/D8). Módulo puro. */

export type SummaryTransaction = {
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  /** Canal de la venta asociada, o null si el movimiento no pertenece a una venta. */
  channel: string | null;
  voided: boolean;
};

export type MonthlySummary = {
  income: number;
  expense: number;
  profit: number;
  incomeByChannel: Record<string, number>;
  expenseByCategory: Record<string, number>;
};

export function monthlySummary(transactions: readonly SummaryTransaction[]): MonthlySummary {
  const summary: MonthlySummary = { income: 0, expense: 0, profit: 0, incomeByChannel: {}, expenseByCategory: {} };
  for (const transaction of transactions) {
    if (transaction.voided) continue;
    if (transaction.type === "INCOME") {
      summary.income += transaction.amount;
      const key = transaction.channel ?? (transaction.category === "DIGITAL_SALE" ? "DIGITAL" : "OTHER");
      summary.incomeByChannel[key] = (summary.incomeByChannel[key] ?? 0) + transaction.amount;
    } else {
      summary.expense += transaction.amount;
      summary.expenseByCategory[transaction.category] = (summary.expenseByCategory[transaction.category] ?? 0) + transaction.amount;
    }
  }
  summary.profit = summary.income - summary.expense;
  return summary;
}

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const pad = (value: number) => String(value).padStart(2, "0");

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria del taller. */
export function todayInTimeZone(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Mes actual (AAAA-MM) en la zona horaria del taller. */
export function currentMonth(now: Date, timeZone: string): string {
  return todayInTimeZone(now, timeZone).slice(0, 7);
}

function parseMonth(month: string) {
  const match = MONTH.exec(month);
  if (!match) throw new RangeError(`Mes inválido: ${month}`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function isValidMonth(month: unknown): month is string {
  return typeof month === "string" && MONTH.test(month);
}

export function shiftMonth(month: string, delta: number): string {
  const { year, month: value } = parseMonth(month);
  const index = year * 12 + (value - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** Primer y último día del mes (fechas calendario, sin hora). */
export function monthDateRange(month: string): { from: string; to: string } {
  const { year, month: value } = parseMonth(month);
  const lastDay = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` };
}

import { describe, expect, it } from "vitest";
import { currentMonth, monthDateRange, monthlySummary, shiftMonth, todayInTimeZone } from "./money-summary";

describe("resumen mensual", () => {
  it("calcula ingresos, gastos y ganancia, por canal y categoría, excluyendo anulados", () => {
    const summary = monthlySummary([
      { type: "INCOME", category: "ORDER_PAYMENT", amount: 6483, channel: "MERCADOLIBRE", voided: false },
      { type: "INCOME", category: "ORDER_PAYMENT", amount: 20000, channel: "WHATSAPP", voided: false },
      { type: "INCOME", category: "DIGITAL_SALE", amount: 5000, channel: null, voided: false },
      { type: "INCOME", category: "ORDER_PAYMENT", amount: 99999, channel: "WHATSAPP", voided: true },
      { type: "EXPENSE", category: "FILAMENT", amount: 15000, channel: null, voided: false },
      { type: "EXPENSE", category: "REFUNDS", amount: 5000, channel: "WHATSAPP", voided: false },
    ]);
    expect(summary).toEqual({
      income: 31483,
      expense: 20000,
      profit: 11483,
      incomeByChannel: { MERCADOLIBRE: 6483, WHATSAPP: 20000, DIGITAL: 5000 },
      expenseByCategory: { FILAMENT: 15000, REFUNDS: 5000 },
    });
  });

  it("sin movimientos todo es cero", () => {
    expect(monthlySummary([])).toEqual({ income: 0, expense: 0, profit: 0, incomeByChannel: {}, expenseByCategory: {} });
  });

  it("el mes y el día se toman en la zona del taller", () => {
    const now = new Date("2026-12-01T02:00:00Z"); // 30 de noviembre, 23:00 en Santiago
    expect(currentMonth(now, "America/Santiago")).toBe("2026-11");
    expect(todayInTimeZone(now, "America/Santiago")).toBe("2026-11-30");
    expect(currentMonth(now, "UTC")).toBe("2026-12");
  });

  it("calcula el rango de fechas del mes y navega entre meses cruzando el año", () => {
    expect(monthDateRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthDateRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(() => monthDateRange("2026-13")).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";
import { formatDay, formatMonth, formatMonthName } from "./date-labels";

describe("fechas en lenguaje normal", () => {
  it("muestra meses con su nombre", () => {
    expect(formatMonth("2026-11")).toBe("noviembre 2026");
    expect(formatMonth("2027-01")).toBe("enero 2027");
    expect(formatMonthName("2026-10")).toBe("octubre");
    expect(formatMonth("2026-13")).toBe("2026-13");
  });

  it("muestra días como «7 nov 2026» sin depender de la zona horaria", () => {
    expect(formatDay("2026-11-07")).toBe("7 nov 2026");
    expect(formatDay("2026-09-30")).toBe("30 sept 2026");
    expect(formatDay("2026-11-07T00:00:00.000Z")).toBe("7 nov 2026");
    expect(formatDay(null)).toBe("");
    expect(formatDay("mañana")).toBe("mañana");
  });
});

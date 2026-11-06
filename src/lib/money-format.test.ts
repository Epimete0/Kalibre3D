import { describe, expect, it } from "vitest";
import { currencyDecimals, formatMoney, toMinorUnits } from "./money-format";

describe("formato de dinero", () => {
  it("formatea pesos chilenos sin decimales", () => {
    expect(formatMoney(8990, "CLP")).toBe("$8.990");
  });

  it("usa los decimales de cada moneda (unidad mínima)", () => {
    expect(currencyDecimals("CLP")).toBe(0);
    expect(currencyDecimals("PYG")).toBe(0);
    expect(currencyDecimals("USD")).toBe(2);
    expect(toMinorUnits("12,5", "USD")).toBe(1250);
    expect(toMinorUnits("8.990", "CLP")).toBe(8990);
    expect(toMinorUnits("8990", "CLP")).toBe(8990);
  });

  it("rechaza montos inválidos", () => {
    expect(toMinorUnits("abc", "CLP")).toBeNull();
    expect(toMinorUnits("-5", "CLP")).toBeNull();
    expect(toMinorUnits("", "CLP")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { digitsToInt, formatThousands, parseMoneyDigits } from "./money-input";

describe("money-input helpers", () => {
  it("parsea solo dígitos ignorando puntos, comas y espacios", () => {
    expect(parseMoneyDigits("10.000")).toBe("10000");
    expect(parseMoneyDigits("$ 12,500 clp")).toBe("12500");
    expect(parseMoneyDigits("")).toBe("");
  });

  it("formatea miles con punto y recorta ceros iniciales", () => {
    expect(formatThousands("0")).toBe("0");
    expect(formatThousands("001500")).toBe("1.500");
    expect(formatThousands("10000")).toBe("10.000");
    expect(formatThousands("1250000")).toBe("1.250.000");
    expect(formatThousands(8990)).toBe("8.990");
    expect(formatThousands("")).toBe("");
  });

  it("convierte cadenas formateadas o dígitos a enteros no negativos", () => {
    expect(digitsToInt("10.000")).toBe(10000);
    expect(digitsToInt("")).toBe(0);
    expect(digitsToInt("0")).toBe(0);
    expect(digitsToInt("abc")).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { computePieceCost, costPerGramFromKg, mercadoLibreNet, suggestPrice, suggestedMlCommission } from "./costing";

describe("costing", () => {
  it("convierte el costo por kilo en costo por gramo", () => {
    expect(costPerGramFromKg(15000)).toBe(15);
  });

  it("no suma purga en piezas de un color y sí en multicolor", () => {
    const base = { grams: 50, colorsCount: 1, purgeGrams: 20, costPerGram: 15, printMinutes: 120, electricityCostPerHour: 100, packagingCost: 0 };
    expect(computePieceCost(base)).toMatchObject({ totalGrams: 50, materialCost: 750, electricityCost: 200, totalCost: 950 });
    expect(computePieceCost({ ...base, colorsCount: 4 })).toMatchObject({ totalGrams: 70, materialCost: 1050 });
    expect(computePieceCost({ ...base, packagingCost: 300, otherCosts: 50 }).totalCost).toBe(1300);
  });

  it("sugiere el precio por margen sobre el precio y rechaza márgenes inválidos", () => {
    expect(suggestPrice(1000, 0.5)).toBe(2000);
    expect(suggestPrice(1000, 0.3)).toBe(1429);
    expect(() => suggestPrice(1000, 1)).toThrow(RangeError);
    expect(() => suggestPrice(1000, -0.1)).toThrow(RangeError);
  });

  it("caso real de Surko: $8.990 en Mercado Libre con 19% y $799 de envío deja $6.483", () => {
    expect(suggestedMlCommission(8990, 19)).toBe(1708);
    expect(mercadoLibreNet({ salePrice: 8990, commissionPct: 19, sellerShippingCost: 799 })).toEqual({ commission: 1708, net: 6483 });
  });
});

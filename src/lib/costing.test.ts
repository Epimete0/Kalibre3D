import { describe, expect, it } from "vitest";
import {
  computeMaterialCostPerGram,
  computePieceCost,
  costPerGramFromKg,
  mercadoLibreNet,
  suggestMlPriceForTargetNet,
  suggestPrice,
  suggestedMlCommission,
} from "./costing";

describe("costing", () => {
  it("convierte el costo por kilo en costo por gramo", () => {
    expect(costPerGramFromKg(15000)).toBe(15);
  });

  it("calcula el costo por gramo promedio de un material según sus bobinas activas o usa el costo por defecto", () => {
    const spools = [
      { material: "PETG", active: true, totalGrams: 1000, pricePaid: 14000 },
      { material: "PETG", active: true, totalGrams: 1000, pricePaid: 16000 },
      { material: "PETG", active: false, totalGrams: 1000, pricePaid: 30000 },
      { material: "PLA", active: true, totalGrams: 1000, pricePaid: 12000 },
    ];
    expect(computeMaterialCostPerGram(spools, "PETG", 20000)).toBe(15);
    expect(computeMaterialCostPerGram(spools, "PLA", 20000)).toBe(12);
    expect(computeMaterialCostPerGram(spools, "ASA", 18000)).toBe(18);
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

  it("sugiere el precio a publicar en Mercado Libre para conservar el neto objetivo", () => {
    const mlPrice = suggestMlPriceForTargetNet({ targetNet: 6483, commissionPct: 19, sellerShippingCost: 799 });
    const { net } = mercadoLibreNet({ salePrice: mlPrice, commissionPct: 19, sellerShippingCost: 799 });
    expect(net).toBeGreaterThanOrEqual(6483);
    expect(mlPrice).toBe(8990);
  });
});

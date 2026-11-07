import { describe, expect, it } from "vitest";
import {
  computeMaterialCostPerGram,
  directSaleBreakdown,
  electricityCostPerHourFromKwh,
  suggestDirectPrice,
  suggestMlPriceKeeping,
  vatIncluded,
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

describe("costos del inicio guiado: luz por kWh, IVA y comisión adicional", () => {
  it("calcula la luz por hora desde el precio del kWh y los watts de la impresora", () => {
    expect(electricityCostPerHourFromKwh(200, 350)).toBe(70);
    expect(electricityCostPerHourFromKwh(180, 120)).toBe(22);
    expect(electricityCostPerHourFromKwh(0, 350)).toBe(0);
    expect(electricityCostPerHourFromKwh(200, 0)).toBe(0);
  });

  it("separa el IVA incluido en un precio", () => {
    expect(vatIncluded(11900, 19)).toBe(1900);
    expect(vatIncluded(8990, 19)).toBe(1435);
    expect(vatIncluded(8990, 0)).toBe(0);
  });

  it("sin IVA ni comisión, el precio sugerido es el mismo de siempre", () => {
    for (const cost of [525, 1105, 999]) {
      expect(suggestDirectPrice({ totalCost: cost, marginPercent: 60, vatPercent: 0, extraCommissionPercent: 0 })).toBe(suggestPrice(cost, 0.6));
    }
  });

  it("con IVA y comisión adicional, el precio sugerido conserva el margen mínimo y es el menor posible", () => {
    const input = { totalCost: 1105, marginPercent: 60, vatPercent: 19, extraCommissionPercent: 3 };
    const price = suggestDirectPrice(input);
    const ok = directSaleBreakdown({ price, totalCost: 1105, vatPercent: 19, extraCommissionPercent: 3 });
    const before = directSaleBreakdown({ price: price - 1, totalCost: 1105, vatPercent: 19, extraCommissionPercent: 3 });
    expect(ok.profit).toBeGreaterThanOrEqual(Math.ceil(((price - ok.vat) * 60) / 100) - 1);
    expect(ok.marginPercent).toBeGreaterThanOrEqual(60);
    expect(before.profit < ((price - 1 - before.vat) * 60) / 100).toBe(true);
    expect(price).toBeGreaterThan(suggestPrice(1105, 0.6));
  });

  it("rechaza combinaciones imposibles", () => {
    expect(() => suggestDirectPrice({ totalCost: 100, marginPercent: 95, vatPercent: 19, extraCommissionPercent: 50 })).toThrow(RangeError);
  });

  it("el precio de Mercado Libre conserva lo mismo que la venta directa, también con IVA", () => {
    expect(suggestMlPriceKeeping({ keepAfterVat: 6483, commissionPct: 19, sellerShippingCost: 799, vatPercent: 0 })).toBe(8990);
    const keep = 5000;
    const price = suggestMlPriceKeeping({ keepAfterVat: keep, commissionPct: 19, sellerShippingCost: 799, vatPercent: 19 });
    const kept = (p: number) => mercadoLibreNet({ salePrice: p, commissionPct: 19, sellerShippingCost: 799 }).net - vatIncluded(p, 19);
    expect(kept(price)).toBeGreaterThanOrEqual(keep);
    expect(kept(price - 1)).toBeLessThan(keep);
  });
});

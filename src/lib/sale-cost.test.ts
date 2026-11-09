import { describe, expect, it } from "vitest";
import { estimateUnitCost, type CostRates } from "./sale-cost";

const rates: CostRates = {
  spools: [{ material: "PETG", active: true, totalGrams: 1000, pricePaid: 15000 }],
  defaultCostPerKg: 20000,
  electricityCostPerHour: 39,
  packagingCost: 100,
  defaultPurgeGrams: 14,
};

describe("costo unitario al vender", () => {
  it("suma filamento, luz y embalaje con las bobinas activas del taller", () => {
    // 50 g × $15 + 1 h × $39 + $100 = $889
    expect(estimateUnitCost({ material: "PETG", grams: 50, printMinutes: 60 }, rates)).toBe(889);
  });

  it("usa la purga por defecto en piezas multicolor y el costo por kilo por defecto sin bobinas", () => {
    // PLA sin bobinas: $20/g × (50 + 14 g de purga) + $100 de embalaje = $1.380
    expect(estimateUnitCost({ material: "PLA", grams: 50, colorsCount: 2 }, rates)).toBe(1380);
  });

  it("no inventa un costo si faltan el material o los gramos", () => {
    expect(estimateUnitCost({ material: null, grams: 50 }, rates)).toBeNull();
    expect(estimateUnitCost({ material: "PETG", grams: 0 }, rates)).toBeNull();
    expect(estimateUnitCost({ material: "PETG", grams: null }, rates)).toBeNull();
  });
});

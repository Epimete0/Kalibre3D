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

  it("suma desgaste por hora y margen de fallos cuando el taller los configura", () => {
    const withWear: CostRates = {
      ...rates,
      machineWearCostPerHour: 200,
      failurePercent: 10,
    };
    // 50g × 15 = 750; 1h × 39 = 39; 1h × 200 = 200; base = 989; 10% fallo = 99; embalaje = 100 -> 1188
    expect(estimateUnitCost({ material: "PETG", grams: 50, printMinutes: 60 }, withWear)).toBe(1188);
  });

  it("suma insumos extra por pieza (argollas, imanes, tornillos) al costo unitario", () => {
    // 50 g × $15 + 1 h × $39 + $100 embalaje + $150 insumos extra = $1.039
    expect(
      estimateUnitCost({ material: "PETG", grams: 50, printMinutes: 60, suppliesCost: 150 }, rates)
    ).toBe(1039);
  });

  it("no inventa un costo si faltan el material o los gramos", () => {
    expect(estimateUnitCost({ material: null, grams: 50 }, rates)).toBeNull();
    expect(estimateUnitCost({ material: "PETG", grams: 0 }, rates)).toBeNull();
    expect(estimateUnitCost({ material: "PETG", grams: null }, rates)).toBeNull();
  });
});

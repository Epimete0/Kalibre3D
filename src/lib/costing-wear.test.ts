import { describe, expect, it } from "vitest";
import { computePieceCost, machineWearCostPerHourFromReplacement } from "./costing";

describe("desgaste de máquina y margen de fallos en computePieceCost", () => {
  it("calcula desgaste por hora redondeado y retorna 0 ante entradas vacías o inválidas", () => {
    expect(machineWearCostPerHourFromReplacement(600000, 4000)).toBe(150);
    expect(machineWearCostPerHourFromReplacement(0, 4000)).toBe(0);
    expect(machineWearCostPerHourFromReplacement(600000, 0)).toBe(0);
    expect(machineWearCostPerHourFromReplacement(-100, 1000)).toBe(0);
  });

  it("mantiene wearCost y failureCost en 0 cuando son omitidos", () => {
    const result = computePieceCost({
      grams: 50,
      colorsCount: 1,
      purgeGrams: 14,
      costPerGram: 15,
      printMinutes: 120,
      electricityCostPerHour: 100,
      packagingCost: 200,
    });
    expect(result.wearCost).toBe(0);
    expect(result.failureCost).toBe(0);
    expect(result.totalCost).toBe(1150);
  });

  it("aplica desgaste por tiempo de impresión y porcentaje de fallos sobre material + luz + desgaste", () => {
    const result = computePieceCost({
      grams: 100,
      colorsCount: 1,
      purgeGrams: 0,
      costPerGram: 15, // 1500
      printMinutes: 120, // 2h
      electricityCostPerHour: 100, // 200
      machineWearCostPerHour: 150, // 300
      failurePercent: 5, // 5% de (1500+200+300=2000) = 100
      packagingCost: 50,
    });
    expect(result.wearCost).toBe(300);
    expect(result.failureCost).toBe(100);
    expect(result.totalCost).toBe(2150);
  });
});

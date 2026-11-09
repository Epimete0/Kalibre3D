import { describe, expect, it } from "vitest";
import { suggestPrice } from "./costing";
import { computePublicQuote, machineWearPerHour, type PublicQuoteInput } from "./public-quote";

const base: PublicQuoteInput = {
  filamentPricePerKg: 15000,
  grams: 50,
  colorsCount: 1,
  purgeGrams: 14,
  printMinutes: 60,
  kwhPrice: 260,
  printerWatts: 150,
  sparePartsCost: 0,
  machineLifeHours: 0,
  failurePercent: 0,
  suppliesCost: 0,
  packagingCost: 0,
  marginPercent: 60,
  vatPercent: 0,
  extraCommissionPercent: 0,
  mlCommissionPercent: 0,
  mlShippingCost: 0,
};

describe("cotizador público", () => {
  it("calcula filamento y luz por kWh igual que el cotizador del taller", () => {
    const result = computePublicQuote(base);
    expect(result).toMatchObject({ totalGrams: 50, material: 750, electricity: 39, totalCost: 789 });
    expect(result.kwh).toBeCloseTo(0.15);
    expect(result.directPrice).toBe(suggestPrice(789, 0.6));
    expect(result.mlPrice).toBeNull();
  });

  it("suma purga multicolor, desgaste, fallas, insumos y embalaje", () => {
    // Desgaste: $150.000 en 3.000 h = $50 por hora. Fallas 10 % sobre filamento + luz + desgaste.
    const result = computePublicQuote({
      ...base,
      colorsCount: 2,
      sparePartsCost: 150000,
      machineLifeHours: 3000,
      failurePercent: 10,
      suppliesCost: 500,
      packagingCost: 100,
    });
    expect(result.totalGrams).toBe(64);
    expect(result.material).toBe(960);
    expect(result.wear).toBe(50);
    expect(result.failure).toBe(Math.round((960 + 39 + 50) * 0.1));
    expect(result.totalCost).toBe(960 + 39 + 50 + 105 + 500 + 100);
  });

  it("con IVA el precio lo incluye y la ganancia lo descuenta; con Mercado Libre sugiere su precio", () => {
    const result = computePublicQuote({ ...base, vatPercent: 19, mlCommissionPercent: 19, mlShippingCost: 799 });
    expect(result.directVat).toBeGreaterThan(0);
    expect(result.marginPercent).toBeGreaterThanOrEqual(60);
    expect(result.mlPrice).not.toBeNull();
    expect(result.mlPrice!).toBeGreaterThan(result.directPrice);
  });

  it("ignora valores negativos o vacíos sin romperse", () => {
    const result = computePublicQuote({ ...base, grams: -5, printMinutes: Number.NaN, kwhPrice: -1 });
    expect(result.totalCost).toBe(0);
    expect(result.directPrice).toBe(0);
    expect(machineWearPerHour(1000, 0)).toBe(0);
  });
});

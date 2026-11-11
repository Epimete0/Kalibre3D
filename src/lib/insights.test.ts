import { describe, expect, it } from "vitest";
import { aggregateProfitability, OTHER_SALES_KEY, summarizePurchases, type SaleLine } from "./insights";

describe("compras del mes", () => {
  it("suma por tipo sin contar devoluciones ni lo anulado, y resume las bobinas agregadas", () => {
    const summary = summarizePurchases(
      [
        { id: "1", category: "FILAMENT", amount: 15000, occurredOn: "2026-11-07", notes: "Bobina PETG Negro", voided: false },
        { id: "2", category: "FILAMENT", amount: 12000, occurredOn: "2026-11-08", notes: null, voided: true },
        { id: "3", category: "SHIPPING", amount: 3000, occurredOn: "2026-11-08", notes: null, voided: false },
        { id: "4", category: "REFUNDS", amount: 6483, occurredOn: "2026-11-09", notes: null, voided: false },
      ],
      [
        { totalGrams: 1000, pricePaid: 15000 },
        { totalGrams: 500, pricePaid: 9000 },
      ]
    );
    expect(summary.total).toBe(18000);
    expect(summary.byCategory).toEqual([
      { category: "FILAMENT", total: 15000, count: 1 },
      { category: "SHIPPING", total: 3000, count: 1 },
    ]);
    expect(summary.purchases.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(summary.spoolsAdded).toEqual({ count: 2, grams: 1500, averagePerKg: 16000 });
  });

  it("sin bobinas agregadas no inventa un precio por kilo", () => {
    expect(summarizePurchases([], []).spoolsAdded.averagePerKg).toBeNull();
  });
});

describe("rentabilidad por pieza", () => {
  const line = (over: Partial<SaleLine>): SaleLine => ({
    orderId: "o1",
    productId: "p-yaris",
    productName: "Emblema Yaris",
    qty: 1,
    unitPrice: 8990,
    unitCost: 889,
    currentUnitCost: 900,
    ...over,
  });

  it("descuenta la comisión y el envío de Mercado Libre y usa el costo guardado al vender", () => {
    const [yaris] = aggregateProfitability([line({})], [{ id: "o1", discount: 0, mlCommission: 1708, mlShippingCost: 799 }]);
    expect(yaris).toMatchObject({ units: 1, revenue: 6483, cost: 889, profit: 5594, marginPercent: 86, unitsEstimatedToday: 0 });
  });

  it("reparte los cargos del pedido entre sus líneas según su subtotal", () => {
    const result = aggregateProfitability(
      [line({ unitPrice: 6000 }), line({ productId: "p-llavero", productName: "Llavero", unitPrice: 2000, unitCost: 300 })],
      [{ id: "o1", discount: 800, mlCommission: 0, mlShippingCost: 0 }]
    );
    const yaris = result.find((row) => row.productId === "p-yaris");
    const llavero = result.find((row) => row.productId === "p-llavero");
    expect(yaris?.revenue).toBe(5400);
    expect(llavero?.revenue).toBe(1800);
  });

  it("estima con el costo de hoy las ventas sin costo guardado y lo informa", () => {
    const [yaris] = aggregateProfitability(
      [line({ orderId: "o1", qty: 2, unitCost: null }), line({ orderId: "o2", qty: 1 })],
      [
        { id: "o1", discount: 0, mlCommission: 0, mlShippingCost: 0 },
        { id: "o2", discount: 0, mlCommission: 0, mlShippingCost: 0 },
      ]
    );
    expect(yaris).toMatchObject({ units: 3, cost: 900 * 2 + 889, unitsEstimatedToday: 2, unitsWithoutCost: 0 });
  });

  it("agrupa las ventas escritas a mano y no inventa su costo; ordena de mayor a menor ganancia", () => {
    const result = aggregateProfitability(
      [
        line({ productId: null, productName: null, unitPrice: 3000, unitCost: null, currentUnitCost: null }),
        line({ orderId: "o2", unitPrice: 8990 }),
      ],
      [
        { id: "o1", discount: 0, mlCommission: 0, mlShippingCost: 0 },
        { id: "o2", discount: 0, mlCommission: 0, mlShippingCost: 0 },
      ]
    );
    expect(result.map((row) => row.key)).toEqual(["p-yaris", OTHER_SALES_KEY]);
    expect(result[1]).toMatchObject({ revenue: 3000, cost: 0, unitsWithoutCost: 1 });
  });

  it("calcula el IVA contenido y la ganancia neta real cuando hay IVA configurado", () => {
    const revenue = 11900;
    const vatPercent = 19;
    const vat = Math.round((revenue * vatPercent) / (100 + vatPercent));
    const netRevenue = revenue - vat;
    const cost = 2000;
    const netProfit = netRevenue - cost;
    const margin = Math.round((netProfit / netRevenue) * 100);

    expect(vat).toBe(1900);
    expect(netRevenue).toBe(10000);
    expect(netProfit).toBe(8000);
    expect(margin).toBe(80);
  });
});

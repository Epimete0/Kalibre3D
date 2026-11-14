import { describe, expect, it } from "vitest";
import {
  aggregateProductPerformance,
  aggregateProfitability,
  computeOrderEconomics,
  computeSalesEconomicsSummary,
  OTHER_SALES_KEY,
  summarizePurchases,
  type SaleLine,
} from "./insights";

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

describe("economía de ventas, pedido y rendimiento de producto", () => {
  it("resume ventas del mes descontando IVA incluido y costo de fabricación", () => {
    const rows = aggregateProfitability(
      [
        {
          orderId: "o1",
          productId: "p1",
          productName: "Emblema",
          qty: 2,
          unitPrice: 11900,
          unitCost: 1500,
          currentUnitCost: null,
        },
        {
          orderId: "o2",
          productId: null,
          productName: null,
          qty: 1,
          unitPrice: 5950,
          unitCost: null,
          currentUnitCost: null,
        },
      ],
      [
        { id: "o1", discount: 0, mlCommission: 0, mlShippingCost: 0 },
        { id: "o2", discount: 0, mlCommission: 0, mlShippingCost: 0 },
      ]
    );

    const summary = computeSalesEconomicsSummary({ rows, ordersCount: 2, vatPercent: 19 });
    // gross = 23800 + 5950 = 29750; IVA 19% = 4750; net = 25000; cost = 3000; profit = 22000; margin = 88%
    expect(summary).toEqual({
      grossRevenue: 29750,
      vatAmount: 4750,
      netRevenue: 25000,
      productionCost: 3000,
      netProfit: 22000,
      marginPercent: 88,
      units: 3,
      ordersCount: 2,
      unitsWithoutCost: 1,
      unitsEstimatedToday: 0,
    });
  });

  it("calcula costos y margen por pedido con costos guardados, estimados y faltantes", () => {
    const result = computeOrderEconomics({
      expectedReceivable: 11900,
      vatPercent: 19,
      items: [
        { id: "i1", qty: 2, unitCost: 900, currentUnitCost: null },
        { id: "i2", qty: 1, unitCost: null, currentUnitCost: 700 },
        { id: "i3", qty: 1, unitCost: null, currentUnitCost: null },
      ],
    });

    expect(result.vatAmount).toBe(1900);
    expect(result.netRevenue).toBe(10000);
    expect(result.productionCost).toBe(2500); // 1800 + 700
    expect(result.profit).toBe(7500);
    expect(result.marginPercent).toBe(75);
    expect(result.units).toBe(4);
    expect(result.unitsWithoutCost).toBe(1);
    expect(result.unitsEstimatedToday).toBe(1);
    expect(result.itemsById["i1"]).toEqual({ id: "i1", unitCost: 900, totalCost: 1800, source: "stored" });
    expect(result.itemsById["i2"]).toEqual({ id: "i2", unitCost: 700, totalCost: 700, source: "estimated" });
    expect(result.itemsById["i3"]).toEqual({ id: "i3", unitCost: null, totalCost: null, source: "unknown" });
  });

  it("agrega rendimiento de un producto en pedidos mixtos y ordena del más reciente al más antiguo", () => {
    const perf = aggregateProductPerformance({
      productId: "p-target",
      vatPercent: 0,
      orders: [
        {
          id: "o1",
          number: 1,
          channel: "WHATSAPP",
          createdAt: new Date("2026-11-01T12:00:00Z"),
          discount: 1000,
          mlCommission: 0,
          mlShippingCost: 0,
          items: [
            { productId: "p-target", qty: 1, unitPrice: 6000, unitCost: 1000, currentUnitCost: null },
            { productId: "p-other", qty: 1, unitPrice: 4000, unitCost: 500, currentUnitCost: null },
          ],
        },
        {
          id: "o2",
          number: 2,
          channel: "MERCADOLIBRE",
          createdAt: new Date("2026-11-05T12:00:00Z"),
          discount: 0,
          mlCommission: 1900,
          mlShippingCost: 800,
          items: [
            { productId: "p-target", qty: 2, unitPrice: 5000, unitCost: 1000, currentUnitCost: null },
          ],
        },
      ],
    });

    // o1: 6000 de 10000 -> 60% del descuento (600) => revenue 5400, cost 1000, profit 4400
    // o2: 10000 - 2700 = 7300, cost 2000, profit 5300
    expect(perf.units).toBe(3);
    expect(perf.ordersCount).toBe(2);
    expect(perf.grossRevenue).toBe(12700);
    expect(perf.netRevenue).toBe(12700);
    expect(perf.productionCost).toBe(3000);
    expect(perf.profit).toBe(9700);
    expect(perf.marginPercent).toBe(76);
    expect(perf.recentOrders.map((r) => r.orderNumber)).toEqual([2, 1]);
  });
});

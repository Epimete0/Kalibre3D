import { describe, expect, it } from "vitest";
import { splitReceived, splitShares } from "./money-split";

describe("splitReceived", () => {
  it("reparte una venta en IVA, costo y ganancia que suman lo recibido", () => {
    const split = splitReceived({ received: 4000, vatAmount: 639, productionCost: 924 });
    expect(split).toEqual({ received: 4000, vat: 639, cost: 924, profit: 2437 });
    expect(split.vat + split.cost + split.profit).toBe(split.received);
  });

  it("muestra la pérdida cuando el costo supera lo recibido sin IVA", () => {
    expect(splitReceived({ received: 1000, vatAmount: 160, productionCost: 1200 }).profit).toBe(-360);
  });
});

describe("splitShares", () => {
  it("devuelve anchos que suman 100", () => {
    const shares = splitShares(splitReceived({ received: 4000, vatAmount: 639, productionCost: 924 }));
    expect(shares).toEqual({ vat: 16, cost: 23, profit: 61 });
    expect(shares.vat + shares.cost + shares.profit).toBe(100);
  });

  it("no da espacio a una pérdida", () => {
    const shares = splitShares(splitReceived({ received: 1000, vatAmount: 160, productionCost: 1200 }));
    expect(shares.profit).toBe(0);
    expect(shares.vat + shares.cost).toBe(100);
  });

  it("queda vacía cuando no hay nada recibido", () => {
    expect(splitShares(splitReceived({ received: 0, vatAmount: 0, productionCost: 500 }))).toEqual({ vat: 0, cost: 0, profit: 0 });
  });
});

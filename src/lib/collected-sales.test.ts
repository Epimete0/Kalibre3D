import { describe, expect, it } from "vitest";
import { allocateCollected, collectedOrderPeriod } from "./collected-sales";

describe("ventas cobradas por periodo", () => {
  it("reparte el cobro o reembolso sin perder unidades mínimas por redondeo", () => {
    expect(allocateCollected(2, [1, 1, 1])).toEqual([1, 1, 0]);
    expect(allocateCollected(-2, [1, 1, 1])).toEqual([-1, -1, 0]);
    expect(allocateCollected(5, [0, 0])).toEqual([3, 2]);
  });
  it("no cuenta una venta sin cobros ni reembolsos", () => {
    expect(collectedOrderPeriod([], "2026-11")).toBeNull();
  });

  it("reconoce cada abono en su mes y el costo solo con el primer abono vigente", () => {
    const movements = [
      { type: "INCOME" as const, amount: 2000, occurredOn: "2026-11-30", voided: false },
      { type: "INCOME" as const, amount: 3000, occurredOn: "2026-12-02", voided: false },
      { type: "INCOME" as const, amount: 9000, occurredOn: "2026-10-01", voided: true },
    ];
    expect(collectedOrderPeriod(movements, "2026-11")).toMatchObject({ revenue: 2000, recognizeCost: true, activityOn: "2026-11-30" });
    expect(collectedOrderPeriod(movements, "2026-12")).toMatchObject({ revenue: 3000, recognizeCost: false, activityOn: "2026-12-02" });
    expect(collectedOrderPeriod(movements, "2026-10")).toBeNull();
  });

  it("resta el reembolso en su mes sin eliminar el costo reconocido antes", () => {
    const movements = [
      { type: "INCOME" as const, amount: 5000, occurredOn: "2026-11-15", voided: false },
      { type: "REFUND" as const, amount: 5000, occurredOn: "2026-12-04", voided: false },
    ];
    expect(collectedOrderPeriod(movements, "2026-11")).toMatchObject({ revenue: 5000, recognizeCost: true });
    expect(collectedOrderPeriod(movements, "2026-12")).toMatchObject({ revenue: -5000, recognizeCost: false });
  });

  it("reconoce el costo de una devolución real aunque no se haya registrado un cobro", () => {
    expect(collectedOrderPeriod([{ type: "REFUND", amount: 1000, occurredOn: "2026-12-01", voided: false }], "2026-12")).toMatchObject({ revenue: -1000, recognizeCost: true });
  });
});

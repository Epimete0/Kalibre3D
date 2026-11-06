import { describe, expect, it } from "vitest";
import { expectedReceivable, isOverdue, orderBalance, orderSubtotal, orderTotal, unitPriceFor } from "./order-totals";

const items = [{ qty: 2, unitPrice: 8990 }, { qty: 1, unitPrice: 18990 }];

describe("totales de venta", () => {
  it("suma cantidad × precio, resta el descuento y nunca baja de cero", () => {
    expect(orderSubtotal(items)).toBe(36970);
    expect(orderTotal(items, 970)).toBe(36000);
    expect(orderTotal(items, 999999)).toBe(0);
  });

  it("en canales directos se espera el total; en Mercado Libre el neto", () => {
    expect(expectedReceivable({ channel: "WHATSAPP", total: 20000, mlCommission: 0, mlShippingCost: 0 })).toBe(20000);
    expect(expectedReceivable({ channel: "MERCADOLIBRE", total: 8990, mlCommission: 1708, mlShippingCost: 799 })).toBe(6483);
  });

  it("el saldo resta solo los cobros no anulados", () => {
    expect(orderBalance(20000, [{ amount: 5000, voided: false }, { amount: 5000, voided: true }])).toBe(15000);
    expect(orderBalance(20000, [{ amount: 20000, voided: false }])).toBe(0);
  });

  it("usa el precio ML de la lista cuando la venta es de Mercado Libre y existe (D4)", () => {
    expect(unitPriceFor({ salePrice: 8990, mlPrice: 9990 }, true)).toBe(9990);
    expect(unitPriceFor({ salePrice: 8990, mlPrice: 9990 }, false)).toBe(8990);
    expect(unitPriceFor({ salePrice: 8990, mlPrice: null }, true)).toBe(8990);
  });

  it("una venta está atrasada si su fecha de entrega ya pasó en la zona del taller y no terminó", () => {
    // 2026-11-08 02:00 UTC es el 7 de noviembre a las 23:00 en Santiago.
    const now = new Date("2026-11-08T02:00:00Z");
    expect(isOverdue({ dueDate: "2026-11-07", status: "PRINTING" }, now, "America/Santiago")).toBe(false);
    expect(isOverdue({ dueDate: "2026-11-06", status: "PRINTING" }, now, "America/Santiago")).toBe(true);
    expect(isOverdue({ dueDate: "2026-11-06", status: "DELIVERED" }, now, "America/Santiago")).toBe(false);
    expect(isOverdue({ dueDate: null, status: "PRINTING" }, now, "America/Santiago")).toBe(false);
  });
});

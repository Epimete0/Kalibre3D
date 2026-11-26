import { describe, expect, it } from "vitest";
import { initialPaymentForChannel, paymentAfterChannelChange, paymentAfterKindChange } from "./initial-payment";

describe("cobro inicial de una venta", () => {
  it("no marca como cobrado Mercado Libre, tampoco cuando es el canal recordado", () => {
    expect(initialPaymentForChannel("MERCADOLIBRE")).toBe(false);
    expect(initialPaymentForChannel("WHATSAPP")).toBe(true);
  });

  it("al cambiar a Mercado Libre deja el cobro pendiente, pero conserva la elección si se vuelve a elegir el mismo canal", () => {
    expect(paymentAfterChannelChange("WHATSAPP", "MERCADOLIBRE", true)).toBe(false);
    expect(paymentAfterChannelChange("MERCADOLIBRE", "MERCADOLIBRE", true)).toBe(true);
    expect(paymentAfterChannelChange("MERCADOLIBRE", "WHATSAPP", false)).toBe(false);
  });

  it("no activa automáticamente el cobro de Mercado Libre al alternar el tipo de venta", () => {
    expect(paymentAfterKindChange("MERCADOLIBRE", "QUICK_SALE", false)).toBe(false);
    expect(paymentAfterKindChange("MERCADOLIBRE", "QUICK_SALE", true)).toBe(true);
    expect(paymentAfterKindChange("WHATSAPP", "QUICK_SALE", false)).toBe(true);
    expect(paymentAfterKindChange("WHATSAPP", "ORDER", false)).toBe(false);
  });
});

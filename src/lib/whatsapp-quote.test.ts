import { describe, expect, it } from "vitest";
import { buildWhatsAppChatUrl, formatWhatsAppOrderSummary, formatWhatsAppQuote } from "./whatsapp-quote";

describe("formateador de presupuesto y pedido para WhatsApp", () => {
  it("genera presupuesto claro sin filtrar costos internos ni margen", () => {
    const text = formatWhatsAppQuote({
      workshopName: "Surco 3D",
      pieceName: "Soporte GoPro",
      material: "PLA",
      quantity: 2,
      grams: 45,
      colorsCount: 1,
      printMinutes: 90,
      unitPrice: 4500,
      totalPrice: 9000,
      currency: "CLP",
      includeVat: true,
    });

    expect(text).toContain("*Presupuesto de impresión 3D*");
    expect(text).toContain("Pieza: Soporte GoPro (PLA)");
    expect(text).toContain("Cantidad: 2 unidades");
    expect(text).toContain("Tiempo aprox.: 1 h 30 min · Peso: 45 g");
    expect(text).toContain("*Valor unitario:* $4.500");
    expect(text).toContain("*Total:* $9.000");
    expect(text).toContain("Incluye IVA.");
    expect(text).toContain("_Surco 3D_");
  });

  it("resume un pedido con piezas, envío, abonos y saldo pendiente", () => {
    const text = formatWhatsAppOrderSummary({
      orderNumber: 42,
      statusLabel: "En impresión",
      customerName: "Camila Rojas",
      items: [{ title: "Soporte articulado", quantity: 2, lineTotal: 9000 }],
      shippingCost: 3500,
      discountAmount: 0,
      totalAmount: 12500,
      paidAmount: 5000,
      balanceDue: 7500,
      currency: "CLP",
    });

    expect(text).toContain("pedido *#42*");
    expect(text).toContain("• 2 × Soporte articulado — $9.000");
    expect(text).toContain("• Envío — $3.500");
    expect(text).toContain("*Total:* $12.500");
    expect(text).toContain("*Saldo pendiente:* $7.500");
  });

  it("arma enlace wa.me válido solo cuando hay teléfono usable", () => {
    expect(buildWhatsAppChatUrl("+56 9 1234 5678", "Hola")).toBe("https://wa.me/56912345678?text=Hola");
    expect(buildWhatsAppChatUrl("123", "Hola")).toBeNull();
    expect(buildWhatsAppChatUrl(null, "Hola")).toBeNull();
  });
});

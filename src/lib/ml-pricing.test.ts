import { describe, expect, it } from "vitest";
import {
  computeMlNetFromPublished,
  computeMlPublishedFromNet,
  unitPriceForOrderChannel,
} from "./ml-pricing";

describe("ml-pricing helpers", () => {
  const settings = {
    mlCommissionPercent: 19,
    mlDefaultShippingCost: 799,
  };

  it("calcula precio publicado desde monto neto objetivo sin quedar por debajo del neto", () => {
    const published = computeMlPublishedFromNet(6483, settings);
    expect(published).toBeGreaterThanOrEqual(8980);
    const { net } = computeMlNetFromPublished(published, settings);
    expect(net).toBeGreaterThanOrEqual(6483);
  });

  it("maneja montos 0 o inválidos devolviendo 0", () => {
    expect(computeMlPublishedFromNet(0, settings)).toBe(0);
    expect(computeMlPublishedFromNet(-500, settings)).toBe(0);
    expect(computeMlNetFromPublished(0, settings)).toEqual({ commission: 0, net: 0 });
  });

  it("calcula neto desde publicado descontando comisión y envío del taller", () => {
    const res = computeMlNetFromPublished(10000, {
      mlCommissionPercent: 19,
      mlDefaultShippingCost: 1000,
    });
    expect(res.commission).toBe(1900);
    expect(res.net).toBe(7100);
  });

  it("resuelve precio unitario para Nueva Venta según canal y modo ML (PUBLISHED vs NET)", () => {
    const product = { salePrice: 7000, mlPrice: 10000 };

    expect(
      unitPriceForOrderChannel(product, "WHATSAPP", "PUBLISHED", settings)
    ).toBe(7000);

    expect(
      unitPriceForOrderChannel(product, "MERCADOLIBRE", "PUBLISHED", settings)
    ).toBe(10000);

    expect(
      unitPriceForOrderChannel(product, "MERCADOLIBRE", "NET", {
        mlCommissionPercent: 19,
        mlDefaultShippingCost: 1000,
      })
    ).toBe(7100);

    // Sin mlPrice configurado en el producto, usa salePrice sin descontar dos veces
    expect(
      unitPriceForOrderChannel({ salePrice: 7000, mlPrice: null }, "MERCADOLIBRE", "NET", settings)
    ).toBe(7000);
  });
});

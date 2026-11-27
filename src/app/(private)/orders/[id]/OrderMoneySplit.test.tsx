import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderMoneySplit } from "./OrderMoneySplit";
import type { OrderEconomics } from "@/lib/insights";

const economics: OrderEconomics = {
  expectedReceivable: 10000,
  vatAmount: 1597,
  netRevenue: 8403,
  productionCost: 1000,
  profit: 7403,
  marginPercent: 88,
  units: 1,
  unitsWithoutCost: 0,
  unitsEstimatedToday: 0,
  itemsById: {},
};

describe("Reparto del pedido", () => {
  it("distingue un abono del reparto estimado del pedido completo", () => {
    const html = renderToStaticMarkup(<OrderMoneySplit economics={economics} vatPercent={19} currency="CLP" paidAmount={2000} balance={8000} isMercadoLibre={false} />);
    expect(html).toContain("Estimación del pedido completo");
    expect(html).toContain("Cobrado hasta ahora");
    expect(html).toContain("$2.000");
    expect(html).toContain("$8.000");
    expect(html).not.toContain("que recibes");
  });

  it("identifica el cobro aun cuando el pedido esté pagado por completo", () => {
    const html = renderToStaticMarkup(<OrderMoneySplit economics={economics} vatPercent={19} currency="CLP" paidAmount={10000} balance={0} isMercadoLibre={true} />);
    expect(html).toContain("Cobrado hasta ahora");
    expect(html).toContain("Mercado Libre");
    expect(html).toContain("Ganancia estimada");
  });
});

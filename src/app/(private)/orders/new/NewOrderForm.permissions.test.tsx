import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../actions", () => ({ createOrderAction: vi.fn() }));

import { NewOrderForm } from "./NewOrderForm";

const props = {
  operationId: "22222222-2222-4222-8222-222222222222",
  products: [],
  customers: [],
  settings: { currency: "CLP", mlCommissionPercent: 0, mlDefaultShippingCost: 0 },
  initialChannel: "WHATSAPP" as const,
};

describe("Permisos de cobro en el formulario", () => {
  it("no ofrece registrar un cobro al ayudante", () => {
    const html = renderToStaticMarkup(<NewOrderForm {...props} canRegisterPayment={false} />);
    expect(html).toContain("El dueño o administrador puede registrar el cobro después de guardar el pedido.");
    expect(html).not.toContain("Cobrada ahora");
  });

  it("permite registrar el cobro a quien administra", () => {
    const html = renderToStaticMarkup(<NewOrderForm {...props} canRegisterPayment />);
    expect(html).toContain("Cobrada ahora");
    expect(html).not.toContain("El dueño o administrador puede registrar el cobro después de guardar el pedido.");
  });
});

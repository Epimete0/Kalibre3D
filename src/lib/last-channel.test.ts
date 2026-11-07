import { describe, expect, it } from "vitest";
import { effectiveMlCommission, LAST_CHANNEL_COOKIE, lastChannelCookie, parseLastChannel } from "./last-channel";

describe("canal recordado y comisión de Mercado Libre en Nueva venta", () => {
  it("acepta solo canales válidos y usa WhatsApp por defecto", () => {
    expect(parseLastChannel("MERCADOLIBRE")).toBe("MERCADOLIBRE");
    expect(parseLastChannel("IN_PERSON")).toBe("IN_PERSON");
    expect(parseLastChannel(undefined)).toBe("WHATSAPP");
    expect(parseLastChannel("")).toBe("WHATSAPP");
    expect(parseLastChannel("<script>")).toBe("WHATSAPP");
  });

  it("la cookie es de interfaz: ruta raíz, un año y SameSite=Lax", () => {
    expect(lastChannelCookie("INSTAGRAM")).toBe(`${LAST_CHANNEL_COOKIE}=INSTAGRAM; Path=/; Max-Age=31536000; SameSite=Lax`);
  });

  it("la comisión sigue al total mientras no se escriba a mano", () => {
    expect(effectiveMlCommission(0, 19, null)).toBe(0);
    expect(effectiveMlCommission(8990, 19, null)).toBe(1708);
    expect(effectiveMlCommission(8990, 19, 1500)).toBe(1500);
    expect(effectiveMlCommission(8990, 19, 0)).toBe(0);
  });
});

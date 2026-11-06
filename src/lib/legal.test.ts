import { describe, expect, it } from "vitest";
import { hasAcceptedTerms, TERMS_VERSION } from "./legal";
import { siteUrl } from "./site-url";

describe("aceptación de términos", () => {
  it("solo una casilla marcada cuenta como aceptación", () => {
    expect(hasAcceptedTerms("on")).toBe(true);
    for (const value of [null, "", "off", "true", "1", "ON"]) expect(hasAcceptedTerms(value)).toBe(false);
  });

  it("la versión es una fecha ISO válida", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(new Date(`${TERMS_VERSION}T00:00:00Z`).getTime())).toBe(false);
  });
});

describe("dirección del sitio", () => {
  it("quita barras finales y usa localhost si no hay configuración", () => {
    const original = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://kurova.example///";
    expect(siteUrl()).toBe("https://kurova.example");
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
    if (original !== undefined) process.env.NEXT_PUBLIC_SITE_URL = original;
  });
});

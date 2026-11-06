import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("permite rutas locales con query y hash", () => {
    expect(safeRedirectPath("/appointments?date=today#new")).toBe("/appointments?date=today#new");
  });

  it.each(["//evil.example", "https://evil.example", "http://evil.example", "\\evil.example", "\\\\evil.example", "/\\evil.example", "javascript:alert(1)", "data:text/html,test"])("rechaza destinos externos: %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });

  it.each(["/dashboard", "/products", "/purchases/123", "/quotes?status=DRAFT", "/appointments?date=today#new"])("acepta rutas locales: %s", (value) => {
    expect(safeRedirectPath(value)).toBe(value);
  });
});

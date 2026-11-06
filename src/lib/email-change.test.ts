import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailChangeSentMessage, parseNewEmail, requestEmailChange, type EmailChangeDeps } from "./email-change";

const deps = (over: Partial<EmailChangeDeps> = {}): EmailChangeDeps => ({
  readAutoconfirm: vi.fn().mockResolvedValue(false),
  updateUser: vi.fn().mockResolvedValue({ error: null }),
  ...over,
});

describe("parseNewEmail", () => {
  it("normaliza y valida", () => {
    expect(parseNewEmail("  Ana@Correo.COM ", "otra@correo.com")).toBe("ana@correo.com");
    expect(() => parseNewEmail("", "a@b.cl")).toThrow("Escribe el correo nuevo.");
    expect(() => parseNewEmail("sin-arroba", "a@b.cl")).toThrow("El correo no es válido.");
    expect(() => parseNewEmail("x".repeat(250) + "@a.cl", "a@b.cl")).toThrow("demasiado largo");
    expect(() => parseNewEmail(undefined, "a@b.cl")).toThrow("Escribe el correo nuevo.");
  });
  it("rechaza el mismo correo sin importar mayúsculas", () => {
    expect(() => parseNewEmail("ANA@correo.com", "ana@correo.com")).toThrow("Ese ya es tu correo de acceso.");
  });
});

describe("requestEmailChange", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pide el cambio con confirmación y vuelve al perfil", async () => {
    const d = deps();
    const result = await requestEmailChange("Nuevo@Correo.cl", "viejo@correo.cl", d);
    expect(result).toEqual({ email: "nuevo@correo.cl" });
    expect(d.updateUser).toHaveBeenCalledWith("nuevo@correo.cl", expect.stringMatching(/\/auth\/callback\?next=\/profile$/));
  });

  it("NO pide el cambio si el servicio lo aplicaría sin confirmación", async () => {
    const d = deps({ readAutoconfirm: vi.fn().mockResolvedValue(true) });
    await expect(requestEmailChange("nuevo@correo.cl", "viejo@correo.cl", d)).rejects.toThrow(/todavía no está disponible/);
    expect(d.updateUser).not.toHaveBeenCalled();
  });

  it("NO pide el cambio si no se pudo saber la configuración (falla cerrada)", async () => {
    const d = deps({ readAutoconfirm: vi.fn().mockResolvedValue(null) });
    await expect(requestEmailChange("nuevo@correo.cl", "viejo@correo.cl", d)).rejects.toThrow(/todavía no está disponible/);
    expect(d.updateUser).not.toHaveBeenCalled();
  });

  it("no revela si el correo ya tiene cuenta: mismo mensaje que cualquier otro fallo", async () => {
    const existing = deps({ updateUser: vi.fn().mockResolvedValue({ error: { code: "email_exists", status: 422 } }) });
    const other = deps({ updateUser: vi.fn().mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } }) });
    const a = await requestEmailChange("ocupado@correo.cl", "viejo@correo.cl", existing).catch((error: Error) => error.message);
    const b = await requestEmailChange("otro@correo.cl", "viejo@correo.cl", other).catch((error: Error) => error.message);
    expect(a).toBe(b);
    expect(a).toMatch(/No fue posible solicitar el cambio de correo/);
    expect(String(a)).not.toMatch(/existe|registrad|cuenta/i);
  });

  it("avisa cuando se envían demasiados correos", async () => {
    const d = deps({ updateUser: vi.fn().mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } }) });
    await expect(requestEmailChange("nuevo@correo.cl", "viejo@correo.cl", d)).rejects.toThrow("Se enviaron demasiados correos. Intenta de nuevo en unos minutos.");
  });
});

describe("emailChangeSentMessage", () => {
  it("empieza con mayúscula, termina con punto y dice a dónde se envió", () => {
    const message = emailChangeSentMessage("nuevo@correo.cl");
    expect(message).toMatch(/^Te enviamos/);
    expect(message).toMatch(/\.$/);
    expect(message).toContain("nuevo@correo.cl");
  });
});

import { describe, expect, it } from "vitest";
import { DomainError, safeActionError } from "@/lib/action-errors";
import { requireRole, type AuthContext } from "@/lib/auth";

const context = (role: AuthContext["role"]) => ({ userId: "u", centerId: "c", role, timeZone: "UTC" }) as AuthContext;

describe("permisos: mensaje legible", () => {
  it("requireRole lanza un DomainError que safeActionError muestra al usuario", () => {
    let caught: unknown;
    try { requireRole(context("VIEWER"), ["OWNER"]); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(DomainError);
    expect(safeActionError(caught, "genérico")).toBe("No tienes permisos para realizar esta acción.");
  });

  it("permite el rol autorizado", () => {
    expect(() => requireRole(context("OWNER"), ["OWNER", "ADMIN"])).not.toThrow();
  });
});

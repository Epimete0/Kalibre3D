import { describe, expect, it } from "vitest";
import { canToggleActive, invitableRoles, invitationStatus, roleOptionsFor, validateActiveChange, validateRoleChange, type TeamActor, type TeamTarget } from "./team-rules";

const owner: TeamActor = { userId: "o1", role: "OWNER" };
const admin: TeamActor = { userId: "a1", role: "ADMIN" };
const pro: TeamActor = { userId: "p1", role: "PROFESSIONAL" };
const t = (userId: string, role: TeamTarget["role"], active = true): TeamTarget => ({ userId, role, active });

describe("cambiar el rol", () => {
  it("el dueño cambia a cualquiera entre ADMIN, PROFESSIONAL y VIEWER", () => {
    expect(validateRoleChange(owner, t("x", "PROFESSIONAL"), "ADMIN", 1)).toBeNull();
    expect(validateRoleChange(owner, t("x", "ADMIN"), "VIEWER", 1)).toBeNull();
  });
  it("nadie asigna OWNER desde la pantalla ni un rol desconocido", () => {
    expect(validateRoleChange(owner, t("x", "PROFESSIONAL"), "OWNER", 1)).toBe("El rol elegido no es válido.");
    expect(validateRoleChange(owner, t("x", "PROFESSIONAL"), "REINA", 1)).toBe("El rol elegido no es válido.");
  });
  it("el administrador solo mueve a PROFESSIONAL y VIEWER entre sí", () => {
    expect(validateRoleChange(admin, t("x", "PROFESSIONAL"), "VIEWER", 1)).toBeNull();
    expect(validateRoleChange(admin, t("x", "VIEWER"), "ADMIN", 1)).toBe("Solo un dueño puede nombrar administradores.");
    expect(validateRoleChange(admin, t("o", "OWNER"), "VIEWER", 1)).toMatch(/Solo un dueño/);
    expect(validateRoleChange(admin, t("b", "ADMIN"), "VIEWER", 1)).toMatch(/Solo un dueño/);
    expect(validateRoleChange(admin, t("a1", "ADMIN"), "VIEWER", 1)).toMatch(/Solo un dueño/);
  });
  it("un ayudante o lector no administra a nadie", () => {
    expect(validateRoleChange(pro, t("x", "VIEWER"), "PROFESSIONAL", 1)).toBe("No tienes permisos para administrar al equipo.");
    expect(validateRoleChange({ userId: "v", role: "VIEWER" }, t("x", "PROFESSIONAL"), "VIEWER", 1)).toBe("No tienes permisos para administrar al equipo.");
  });
  it("no se baja de rol a la última dueño, pero sí si queda otra", () => {
    expect(validateRoleChange(owner, t("o1", "OWNER"), "ADMIN", 0)).toBe("El taller debe conservar al menos un dueño activo.");
    expect(validateRoleChange(owner, t("o2", "OWNER"), "ADMIN", 1)).toBeNull();
  });
  it("no cambia el rol de alguien desactivado ni al mismo rol", () => {
    expect(validateRoleChange(owner, t("x", "PROFESSIONAL", false), "VIEWER", 1)).toBe("Reactiva a la persona antes de cambiarle el rol.");
    expect(validateRoleChange(owner, t("x", "VIEWER"), "VIEWER", 1)).toBe("La persona ya tiene ese rol.");
  });
});

describe("desactivar y reactivar", () => {
  it("el dueño desactiva y reactiva; el administrador solo a ayudantes y lectores", () => {
    expect(validateActiveChange(owner, t("x", "ADMIN"), false, 1)).toBeNull();
    expect(validateActiveChange(admin, t("x", "PROFESSIONAL"), false, 1)).toBeNull();
    expect(validateActiveChange(admin, t("x", "PROFESSIONAL", false), true, 1)).toBeNull();
    expect(validateActiveChange(admin, t("o", "OWNER"), false, 1)).toMatch(/Solo un dueño/);
  });
  it("nadie se desactiva a sí mismo y el último dueño no se desactiva", () => {
    expect(validateActiveChange(owner, t("o1", "OWNER"), false, 1)).toBe("No puedes desactivarte a ti misma.");
    expect(validateActiveChange(owner, t("o2", "OWNER"), false, 0)).toBe("El taller debe conservar al menos un dueño activo.");
  });
  it("no repite el estado actual", () => {
    expect(validateActiveChange(owner, t("x", "VIEWER"), true, 1)).toBe("La persona ya está activa.");
    expect(validateActiveChange(owner, t("x", "VIEWER", false), false, 1)).toBe("La persona ya está desactivada.");
  });
});

describe("lo que ofrece la pantalla", () => {
  it("roles ofrecidos según quién mira y a quién", () => {
    expect(roleOptionsFor(owner, t("x", "PROFESSIONAL"))).toEqual(["ADMIN", "VIEWER"]);
    expect(roleOptionsFor(admin, t("x", "PROFESSIONAL"))).toEqual(["VIEWER"]);
    expect(roleOptionsFor(admin, t("o", "OWNER"))).toEqual([]);
    expect(roleOptionsFor(pro, t("x", "VIEWER"))).toEqual([]);
    expect(roleOptionsFor(owner, t("x", "VIEWER", false))).toEqual([]);
  });
  it("los botones de desactivar", () => {
    expect(canToggleActive(owner, t("o1", "OWNER"))).toBe(false);
    expect(canToggleActive(owner, t("x", "ADMIN"))).toBe(true);
    expect(canToggleActive(admin, t("x", "ADMIN"))).toBe(false);
    expect(canToggleActive(owner, t("x", "VIEWER", false))).toBe(true);
  });
  it("roles invitables", () => {
    expect(invitableRoles("OWNER")).toEqual(["ADMIN", "PROFESSIONAL", "VIEWER"]);
    expect(invitableRoles("ADMIN")).toEqual(["PROFESSIONAL", "VIEWER"]);
    expect(invitableRoles("PROFESSIONAL")).toEqual([]);
  });
  it("estado de una invitación", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const base = { redeemedAt: null, revokedAt: null, expiresAt: new Date("2026-11-10T00:00:00Z") };
    expect(invitationStatus(base, now)).toBe("ACTIVE");
    expect(invitationStatus({ ...base, expiresAt: new Date("2026-11-05T12:00:00Z") }, now)).toBe("EXPIRED");
    expect(invitationStatus({ ...base, revokedAt: now }, now)).toBe("REVOKED");
    expect(invitationStatus({ ...base, redeemedAt: now, revokedAt: now }, now)).toBe("REDEEMED");
  });
});

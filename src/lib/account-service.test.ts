import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireSessionUser, requireCatalogContext } = vi.hoisted(() => ({
  prisma: { profile: { upsert: vi.fn() }, center: { updateMany: vi.fn(), findFirst: vi.fn() } },
  requireSessionUser: vi.fn().mockResolvedValue("user-a"),
  requireCatalogContext: vi.fn().mockResolvedValue({ userId: "user-a", centerId: "center-a", role: "OWNER" }),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireSessionUser, requireCatalogContext }));

import { parsePasswordChange, updateCenterSettings, updateDisplayName } from "./account-service";

const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [k, v] of Object.entries(fields)) data.set(k, v); return data; };

describe("cuenta y taller", () => {
  beforeEach(() => { vi.clearAllMocks(); prisma.center.updateMany.mockResolvedValue({ count: 1 }); });

  it("el nombre visible se guarda recortado y para la persona de la sesión", async () => {
    await updateDisplayName(form({ displayName: "  Ana Soto " }));
    expect(prisma.profile.upsert).toHaveBeenCalledWith({ where: { id: "user-a" }, create: { id: "user-a", displayName: "Ana Soto" }, update: { displayName: "Ana Soto" } });
  });
  it("rechaza un nombre vacío o demasiado largo sin tocar la base", async () => {
    await expect(updateDisplayName(form({ displayName: "   " }))).rejects.toThrow("Escribe tu nombre.");
    await expect(updateDisplayName(form({ displayName: "x".repeat(81) }))).rejects.toThrow(/demasiado largo/);
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });
  it("nombre y zona horaria del taller se guardan juntos, solo en el taller de la sesión y activo", async () => {
    await updateCenterSettings(form({ name: " Estudio Luz ", timeZone: "America/Bogota" }));
    expect(prisma.center.updateMany).toHaveBeenCalledWith({ where: { id: "center-a", active: true }, data: { name: "Estudio Luz", timeZone: "America/Bogota" } });
  });
  it("si algo no es válido no se guarda nada (ni el nombre)", async () => {
    await expect(updateCenterSettings(form({ name: "", timeZone: "America/Bogota" }))).rejects.toThrow("Escribe el nombre del taller.");
    await expect(updateCenterSettings(form({ name: "Bien", timeZone: "Marte/Fobos" }))).rejects.toThrow("La zona horaria del taller no es válida.");
    await expect(updateCenterSettings(form({ name: "Bien" }))).rejects.toThrow("La zona horaria del taller no es válida.");
    expect(prisma.center.updateMany).not.toHaveBeenCalled();
    prisma.center.updateMany.mockResolvedValue({ count: 0 });
    await expect(updateCenterSettings(form({ name: "Otro", timeZone: "America/Bogota" }))).rejects.toThrow(/No fue posible/);
  });
  it("la contraseña pide 8 caracteres, tope y confirmación", () => {
    expect(parsePasswordChange(form({ password: "clave-segura", confirm: "clave-segura" }))).toBe("clave-segura");
    expect(() => parsePasswordChange(form({ password: "corta", confirm: "corta" }))).toThrow("al menos 8");
    expect(() => parsePasswordChange(form({ password: "clave-segura", confirm: "otra-clave" }))).toThrow("no coinciden");
    expect(() => parsePasswordChange(form({ password: "x".repeat(73), confirm: "x".repeat(73) }))).toThrow(/demasiado larga/);
  });
});

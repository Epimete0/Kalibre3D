import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateMany, requireCatalogContext } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  requireCatalogContext: vi.fn(),
}));

vi.mock("./prisma", () => ({ prisma: { center: { updateMany } } }));
vi.mock("./auth", () => ({ requireCatalogContext }));

import { updateCenterTimeZone } from "./center-service";

function form(timeZone: string, centerId?: string) {
  const data = new FormData();
  data.set("timeZone", timeZone);
  if (centerId) data.set("centerId", centerId);
  return data;
}

describe("center time zone service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCatalogContext.mockResolvedValue({ userId: "user-a", centerId: "center-a", role: "OWNER" });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("allows an OWNER to save the authenticated center time zone", async () => {
    await updateCenterTimeZone(form("America/Santiago"));

    expect(updateMany).toHaveBeenCalledWith({ where: { id: "center-a" }, data: { timeZone: "America/Santiago" } });
  });

  it("allows an ADMIN to save a valid time zone", async () => {
    requireCatalogContext.mockResolvedValueOnce({ userId: "user-a", centerId: "center-a", role: "ADMIN" });

    await updateCenterTimeZone(form("America/New_York"));

    expect(updateMany).toHaveBeenCalledWith({ where: { id: "center-a" }, data: { timeZone: "America/New_York" } });
  });

  it("canonicalizes the submitted IANA time zone before persisting it", async () => {
    await updateCenterTimeZone(form("america/new_york"));

    expect(updateMany).toHaveBeenCalledWith({ where: { id: "center-a" }, data: { timeZone: "America/New_York" } });
  });

  it("rejects an invalid IANA time zone before writing", async () => {
    await expect(updateCenterTimeZone(form("America/Does_Not_Exist"))).rejects.toThrow("La zona horaria del taller no es válida.");

    expect(updateMany).not.toHaveBeenCalled();
  });

  it.each(["PROFESSIONAL", "VIEWER"])("does not mutate when %s lacks catalog authorization", async () => {
    requireCatalogContext.mockRejectedValueOnce(new Error("No tienes permisos para realizar esta acción"));

    await expect(updateCenterTimeZone(form("America/Santiago"))).rejects.toThrow("No tienes permisos para realizar esta acción");

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("ignores a centerId submitted by the form", async () => {
    await updateCenterTimeZone(form("America/Santiago", "center-b"));

    expect(updateMany).toHaveBeenCalledWith({ where: { id: "center-a" }, data: { timeZone: "America/Santiago" } });
  });

  it("rejects the write when the authenticated center no longer exists", async () => {
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(updateCenterTimeZone(form("America/Santiago"))).rejects.toThrow("No fue posible actualizar la zona horaria del taller. Intenta nuevamente.");
  });
});

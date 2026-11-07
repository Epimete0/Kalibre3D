import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireCatalogContext, requireOperationalContext } = vi.hoisted(() => ({
  prisma: {
    centerSettings: { upsert: vi.fn(), findUnique: vi.fn(), createMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    center: { findUnique: vi.fn(), updateMany: vi.fn() },
    moneyTransaction: { count: vi.fn() },
    $transaction: vi.fn(),
  },
  requireCatalogContext: vi.fn().mockResolvedValue({ userId: "user-a", centerId: "center-a", role: "OWNER" }),
  requireOperationalContext: vi.fn().mockResolvedValue({ userId: "user-a", centerId: "center-a", role: "OWNER" }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireCatalogContext, requireOperationalContext }));

import { getCenterSettings, updateCenterSettings } from "./center-settings-service";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const validForm = () =>
  form({
    currency: "CLP",
    timeZone: "America/Santiago",
    electricityCostPerHour: "150",
    mlCommissionPercent: "19",
    mlDefaultShippingCost: "799",
    defaultPackagingCost: "250",
    defaultCostPerKg: "15000",
    defaultPurgeGrams: "25",
    lowSpoolThresholdGrams: "150",
  });

describe("center-settings-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.centerSettings.createMany.mockResolvedValue({ count: 1 });
    prisma.centerSettings.findUniqueOrThrow.mockResolvedValue({
      centerId: "center-a",
      currency: "CLP",
      electricityCostPerHour: 0,
      mlCommissionPercent: 19,
      mlDefaultShippingCost: 0,
      defaultPackagingCost: 0,
      defaultCostPerKg: 15000,
      defaultPurgeGrams: 0,
      lowSpoolThresholdGrams: 150,
    });
    prisma.center.findUnique.mockResolvedValue({ timeZone: "America/Santiago" });
    prisma.moneyTransaction.count.mockResolvedValue(0);
    prisma.centerSettings.findUnique.mockResolvedValue({ currency: "CLP" });
    prisma.$transaction.mockImplementation((fns: unknown) =>
      Array.isArray(fns) ? Promise.all(fns) : typeof fns === "function" ? (fns as (tx: unknown) => Promise<unknown>)(prisma) : Promise.resolve()
    );
  });

  describe("getCenterSettings", () => {
    it("crea los valores por defecto sin chocar en paralelo (ON CONFLICT DO NOTHING) y devuelve el estado de bloqueo de moneda", async () => {
      const settings = await getCenterSettings();
      expect(requireOperationalContext).toHaveBeenCalled();
      expect(prisma.centerSettings.createMany).toHaveBeenCalledWith({ data: [{ centerId: "center-a" }], skipDuplicates: true });
      expect(prisma.centerSettings.findUniqueOrThrow).toHaveBeenCalledWith({ where: { centerId: "center-a" } });
      expect(settings.currency).toBe("CLP");
      expect(settings.timeZone).toBe("America/Santiago");
      expect(settings.currencyLocked).toBe(false);
    });

    it("marca la moneda como bloqueada si el taller ya tiene movimientos de dinero", async () => {
      prisma.moneyTransaction.count.mockResolvedValue(3);
      const settings = await getCenterSettings();
      expect(settings.currencyLocked).toBe(true);
    });
  });

  describe("updateCenterSettings", () => {
    it("actualiza la configuración y la zona horaria del taller en una transacción", async () => {
      await updateCenterSettings(validForm());
      expect(requireCatalogContext).toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("bloquea el cambio de moneda si ya existen movimientos de dinero", async () => {
      prisma.centerSettings.findUnique.mockResolvedValue({ currency: "CLP" });
      prisma.moneyTransaction.count.mockResolvedValue(1);

      const f = validForm();
      f.set("currency", "USD");

      await expect(updateCenterSettings(f)).rejects.toThrow(
        "No es posible cambiar la moneda porque el taller ya registra movimientos de dinero."
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("permite cambiar la moneda si no existen movimientos de dinero", async () => {
      prisma.centerSettings.findUnique.mockResolvedValue({ currency: "CLP" });
      prisma.moneyTransaction.count.mockResolvedValue(0);

      const f = validForm();
      f.set("currency", "USD");

      await updateCenterSettings(f);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it("rechaza una moneda no soportada", async () => {
      const f = validForm();
      f.set("currency", "BTC");
      await expect(updateCenterSettings(f)).rejects.toThrow("La moneda seleccionada no es válida.");
    });

    it("rechaza una zona horaria inválida", async () => {
      const f = validForm();
      f.set("timeZone", "Planeta/Tierra");
      await expect(updateCenterSettings(f)).rejects.toThrow("La zona horaria del taller no es válida.");
    });

    it("rechaza montos negativos o no enteros", async () => {
      const f = validForm();
      f.set("electricityCostPerHour", "-10");
      await expect(updateCenterSettings(f)).rejects.toThrow(/no puede ser negativo/);

      const f2 = validForm();
      f2.set("defaultCostPerKg", "15000.5");
      await expect(updateCenterSettings(f2)).rejects.toThrow(/número entero/);
    });

    it("rechaza comisión de Mercado Libre negativa o superior a 100", async () => {
      const f = validForm();
      f.set("mlCommissionPercent", "105");
      await expect(updateCenterSettings(f)).rejects.toThrow(/no puede superar el 100%/);

      const f2 = validForm();
      f2.set("mlCommissionPercent", "-1");
      await expect(updateCenterSettings(f2)).rejects.toThrow(/no puede ser negativa/);
    });
  });
});

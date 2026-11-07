import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext, requireOperationalContext } from "@/lib/auth";
import { validateIanaTimeZone } from "@/lib/center-time-zone";
import { CURRENCIES, type Currency } from "@/lib/money-format";
import { prisma } from "@/lib/prisma";

export type CenterSettingsView = {
  centerId: string;
  currency: Currency;
  timeZone: string;
  electricityCostPerHour: number;
  mlCommissionPercent: number;
  mlDefaultShippingCost: number;
  defaultPackagingCost: number;
  defaultCostPerKg: number;
  defaultPurgeGrams: number;
  lowSpoolThresholdGrams: number;
  currencyLocked: boolean;
};

const centerSettingsSchema = z.object({
  currency: z.enum(CURRENCIES, { error: "La moneda seleccionada no es válida." }),
  timeZone: z.string({ error: "La zona horaria del taller no es válida." }).trim().min(1, "La zona horaria del taller no es válida."),
  electricityCostPerHour: z.coerce
    .number({ error: "El costo de luz por hora no es válido." })
    .int("El costo de luz por hora debe ser un número entero.")
    .min(0, "El costo de luz por hora no puede ser negativo."),
  mlCommissionPercent: z.coerce
    .number({ error: "La comisión de Mercado Libre no es válida." })
    .min(0, "La comisión de Mercado Libre no puede ser negativa.")
    .max(100, "La comisión de Mercado Libre no puede superar el 100%."),
  mlDefaultShippingCost: z.coerce
    .number({ error: "El costo de envío por defecto no es válido." })
    .int("El costo de envío por defecto debe ser un número entero.")
    .min(0, "El costo de envío por defecto no puede ser negativo."),
  defaultPackagingCost: z.coerce
    .number({ error: "El costo de embalaje por defecto no es válido." })
    .int("El costo de embalaje por defecto debe ser un número entero.")
    .min(0, "El costo de embalaje por defecto no puede ser negativo."),
  defaultCostPerKg: z.coerce
    .number({ error: "El costo por kilo no es válido." })
    .int("El costo por kilo debe ser un número entero.")
    .min(0, "El costo por kilo no puede ser negativo."),
  defaultPurgeGrams: z.coerce
    .number({ error: "Los gramos de purga por defecto no son válidos." })
    .int("Los gramos de purga por defecto deben ser un número entero.")
    .min(0, "Los gramos de purga por defecto no pueden ser negativos."),
  lowSpoolThresholdGrams: z.coerce
    .number({ error: "El aviso de bobina baja no es válido." })
    .int("El aviso de bobina baja debe ser un número entero.")
    .min(0, "El aviso de bobina baja no puede ser negativo."),
});

/** Obtiene la configuración del taller activo. Si no existe, crea los valores por defecto (CLP, 19%, etc.). */
export async function getCenterSettings(): Promise<CenterSettingsView> {
  const { centerId } = await requireOperationalContext();

  // Crear la fila por defecto con INSERT … ON CONFLICT DO NOTHING (atómico en PostgreSQL). Un upsert de Prisma
  // aquí fallaba con P2002 cuando el panel pedía la configuración varias veces en paralelo en un taller nuevo.
  await prisma.centerSettings.createMany({ data: [{ centerId }], skipDuplicates: true });

  const [settings, center, txCount] = await Promise.all([
    prisma.centerSettings.findUniqueOrThrow({ where: { centerId } }),
    prisma.center.findUnique({
      where: { id: centerId },
      select: { timeZone: true },
    }),
    prisma.moneyTransaction.count({
      where: { centerId },
    }),
  ]);

  return {
    centerId: settings.centerId,
    currency: settings.currency as Currency,
    timeZone: center?.timeZone || "America/Santiago",
    electricityCostPerHour: settings.electricityCostPerHour,
    mlCommissionPercent: Number(settings.mlCommissionPercent),
    mlDefaultShippingCost: settings.mlDefaultShippingCost,
    defaultPackagingCost: settings.defaultPackagingCost,
    defaultCostPerKg: settings.defaultCostPerKg,
    defaultPurgeGrams: settings.defaultPurgeGrams,
    lowSpoolThresholdGrams: settings.lowSpoolThresholdGrams,
    currencyLocked: txCount > 0,
  };
}

/**
 * Actualiza los ajustes del taller y su zona horaria.
 * Solo OWNER y ADMIN. Si ya existen movimientos de dinero en el taller, la moneda queda bloqueada (D9).
 */
export async function updateCenterSettings(formData: FormData) {
  const { centerId } = await requireCatalogContext();

  const raw = {
    currency: formData.get("currency"),
    timeZone: formData.get("timeZone"),
    electricityCostPerHour: formData.get("electricityCostPerHour"),
    mlCommissionPercent: formData.get("mlCommissionPercent"),
    mlDefaultShippingCost: formData.get("mlDefaultShippingCost"),
    defaultPackagingCost: formData.get("defaultPackagingCost"),
    defaultCostPerKg: formData.get("defaultCostPerKg"),
    defaultPurgeGrams: formData.get("defaultPurgeGrams"),
    lowSpoolThresholdGrams: formData.get("lowSpoolThresholdGrams"),
  };

  const parsed = centerSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos ingresados.");
  }

  let timeZone: string;
  try {
    timeZone = validateIanaTimeZone(parsed.data.timeZone);
  } catch {
    throw new DomainError("La zona horaria del taller no es válida.");
  }

  const currentSettings = await prisma.centerSettings.findUnique({
    where: { centerId },
    select: { currency: true },
  });

  const currentCurrency = currentSettings?.currency ?? "CLP";
  if (parsed.data.currency !== currentCurrency) {
    const txCount = await prisma.moneyTransaction.count({
      where: { centerId },
    });
    if (txCount > 0) {
      throw new DomainError("No es posible cambiar la moneda porque el taller ya registra movimientos de dinero.");
    }
  }

  const roundedCommission = Math.round(parsed.data.mlCommissionPercent * 100) / 100;

  await prisma.$transaction([
    prisma.centerSettings.upsert({
      where: { centerId },
      create: {
        centerId,
        currency: parsed.data.currency,
        electricityCostPerHour: parsed.data.electricityCostPerHour,
        mlCommissionPercent: roundedCommission,
        mlDefaultShippingCost: parsed.data.mlDefaultShippingCost,
        defaultPackagingCost: parsed.data.defaultPackagingCost,
        defaultCostPerKg: parsed.data.defaultCostPerKg,
        defaultPurgeGrams: parsed.data.defaultPurgeGrams,
        lowSpoolThresholdGrams: parsed.data.lowSpoolThresholdGrams,
      },
      update: {
        currency: parsed.data.currency,
        electricityCostPerHour: parsed.data.electricityCostPerHour,
        mlCommissionPercent: roundedCommission,
        mlDefaultShippingCost: parsed.data.mlDefaultShippingCost,
        defaultPackagingCost: parsed.data.defaultPackagingCost,
        defaultCostPerKg: parsed.data.defaultCostPerKg,
        defaultPurgeGrams: parsed.data.defaultPurgeGrams,
        lowSpoolThresholdGrams: parsed.data.lowSpoolThresholdGrams,
      },
    }),
    prisma.center.updateMany({
      where: { id: centerId, active: true },
      data: { timeZone },
    }),
  ]);

  return {
    currency: parsed.data.currency,
    timeZone,
  };
}

/**
 * Cotizador público (landing, sin sesión). Módulo puro: la persona escribe todos sus datos y se calcula
 * el costo real de una pieza y el precio sugerido, reutilizando las reglas de costos de Kalibre.
 * Montos enteros en la unidad mínima de la moneda elegida.
 */
import { directSaleBreakdown, suggestDirectPrice, suggestMlPriceKeeping, vatIncluded } from "./costing";

export type PublicQuoteInput = {
  /** Precio de un kilo de filamento. */
  filamentPricePerKg: number;
  grams: number;
  /** Colores (cambios de filamento); con más de uno se suma la purga. */
  colorsCount: number;
  purgeGrams: number;
  printMinutes: number;
  kwhPrice: number;
  printerWatts: number;
  /** Repuestos que gastas en la vida útil de la impresora (boquillas, cama, correas…). */
  sparePartsCost: number;
  /** Horas de impresión que dura la impresora hasta esos repuestos. */
  machineLifeHours: number;
  /** Porcentaje extra por impresiones fallidas (0 a 100). */
  failurePercent: number;
  /** Insumos por pieza: argolla, imán, tag NFC, etc. */
  suppliesCost: number;
  packagingCost: number;
  marginPercent: number;
  vatPercent: number;
  extraCommissionPercent: number;
  mlCommissionPercent: number;
  mlShippingCost: number;
};

export type PublicQuoteResult = {
  totalGrams: number;
  kwh: number;
  material: number;
  electricity: number;
  wear: number;
  failure: number;
  supplies: number;
  packaging: number;
  totalCost: number;
  directPrice: number;
  directVat: number;
  directCommission: number;
  profit: number;
  marginPercent: number;
  /** null si no vende por Mercado Libre (comisión y envío en 0). */
  mlPrice: number | null;
  mlVat: number;
};

const nonNegative = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** Desgaste de la máquina por hora: repuestos repartidos en su vida útil. */
export function machineWearPerHour(sparePartsCost: number, machineLifeHours: number): number {
  return machineLifeHours > 0 ? nonNegative(sparePartsCost) / machineLifeHours : 0;
}

export function computePublicQuote(raw: PublicQuoteInput): PublicQuoteResult {
  const grams = Math.round(nonNegative(raw.grams));
  const colors = Math.max(1, Math.round(raw.colorsCount || 1));
  const totalGrams = grams + (colors > 1 ? Math.round(nonNegative(raw.purgeGrams)) : 0);
  const hours = nonNegative(raw.printMinutes) / 60;
  const kwh = (nonNegative(raw.printerWatts) * hours) / 1000;

  const material = Math.round((totalGrams * nonNegative(raw.filamentPricePerKg)) / 1000);
  const electricity = Math.round(kwh * nonNegative(raw.kwhPrice));
  const wear = Math.round(hours * machineWearPerHour(raw.sparePartsCost, raw.machineLifeHours));
  const failure = Math.round(((material + electricity + wear) * Math.min(100, nonNegative(raw.failurePercent))) / 100);
  const supplies = Math.round(nonNegative(raw.suppliesCost));
  const packaging = Math.round(nonNegative(raw.packagingCost));
  const totalCost = material + electricity + wear + failure + supplies + packaging;

  const marginPercent = Math.min(95, nonNegative(raw.marginPercent));
  const vatPercent = Math.min(50, nonNegative(raw.vatPercent));
  const extraCommissionPercent = Math.min(50, nonNegative(raw.extraCommissionPercent));

  let directPrice = 0;
  try {
    directPrice = suggestDirectPrice({ totalCost, marginPercent, vatPercent, extraCommissionPercent });
  } catch {
    directPrice = 0;
  }
  const direct = directSaleBreakdown({ price: directPrice, totalCost, vatPercent, extraCommissionPercent });

  const mlCommissionPercent = Math.min(99, nonNegative(raw.mlCommissionPercent));
  const mlShippingCost = Math.round(nonNegative(raw.mlShippingCost));
  let mlPrice: number | null = null;
  if (mlCommissionPercent > 0 || mlShippingCost > 0) {
    try {
      mlPrice = suggestMlPriceKeeping({
        keepAfterVat: directPrice - direct.vat - direct.extraCommission,
        commissionPct: mlCommissionPercent,
        sellerShippingCost: mlShippingCost,
        vatPercent,
      });
    } catch {
      mlPrice = null;
    }
  }

  return {
    totalGrams,
    kwh,
    material,
    electricity,
    wear,
    failure,
    supplies,
    packaging,
    totalCost,
    directPrice,
    directVat: direct.vat,
    directCommission: direct.extraCommission,
    profit: direct.profit,
    marginPercent: direct.marginPercent,
    mlPrice,
    mlVat: mlPrice ? vatIncluded(mlPrice, vatPercent) : 0,
  };
}

/**
 * Consumo promedio aproximado de impresoras comunes mientras imprimen (no el máximo de la fuente).
 * Es una referencia para quien no lo conoce; con un enchufe medidor se obtiene el valor real.
 */
export const PRINTER_PRESETS = [
  { name: "Bambu Lab A1 mini", watts: 45 },
  { name: "Bambu Lab A1", watts: 95 },
  { name: "Bambu Lab P1S / P1P", watts: 100 },
  { name: "Bambu Lab X1 Carbon", watts: 120 },
  { name: "Prusa MK4 / MK3S+", watts: 90 },
  { name: "Creality Ender 3 (V2, S1, V3)", watts: 110 },
  { name: "Creality K1 / K1C", watts: 100 },
  { name: "Creality K1 Max", watts: 200 },
  { name: "Anycubic Kobra (2, 3, S1)", watts: 90 },
  { name: "Anycubic Kobra X / multicolor", watts: 120 },
  { name: "Elegoo Neptune 4", watts: 110 },
  { name: "Resina (Elegoo, Anycubic Photon)", watts: 60 },
] as const;

/** Referencias de margen según el tipo de venta, para elegir sin adivinar. */
export const MARGIN_GUIDE = [
  { margin: 40, label: "Mayorista o mucho volumen" },
  { margin: 50, label: "Piezas de catálogo con competencia" },
  { margin: 60, label: "Venta normal al cliente final" },
  { margin: 70, label: "Personalizadas o piezas chicas (llaveros)" },
] as const;

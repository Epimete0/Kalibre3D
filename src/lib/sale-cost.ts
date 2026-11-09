/**
 * Costo unitario estimado de una línea de venta, para guardarlo al vender (rentabilidad por pieza).
 * Módulo puro: recibe las especificaciones de la pieza y las tarifas del taller de ese momento.
 */
import { computeMaterialCostPerGram, computePieceCost, type SpoolCostSample } from "./costing";

export type PieceSpec = {
  material: string | null;
  grams: number | null;
  printMinutes?: number | null;
  colorsCount?: number | null;
  purgeGrams?: number | null;
};

export type CostRates = {
  spools: readonly SpoolCostSample[];
  defaultCostPerKg: number;
  electricityCostPerHour: number;
  packagingCost: number;
  defaultPurgeGrams: number;
};

/**
 * Devuelve el costo unitario (entero, unidad mínima) o null si no hay datos suficientes:
 * sin material o sin gramos no se puede estimar el filamento, que es el costo principal.
 */
export function estimateUnitCost(spec: PieceSpec, rates: CostRates): number | null {
  const grams = spec.grams ?? 0;
  if (!spec.material || grams <= 0) return null;
  const colorsCount = Math.max(1, spec.colorsCount ?? 1);
  const purgeGrams = spec.purgeGrams && spec.purgeGrams > 0 ? spec.purgeGrams : rates.defaultPurgeGrams;
  const costPerGram = computeMaterialCostPerGram(rates.spools, spec.material, rates.defaultCostPerKg);
  return computePieceCost({
    grams,
    colorsCount,
    purgeGrams,
    costPerGram,
    printMinutes: Math.max(0, spec.printMinutes ?? 0),
    electricityCostPerHour: rates.electricityCostPerHour,
    packagingCost: rates.packagingCost,
  }).totalCost;
}

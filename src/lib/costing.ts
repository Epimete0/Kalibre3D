/**
 * Costos y precios de una pieza impresa (onyx.md sección 7). Módulo puro: sin base de datos.
 * Todos los montos son enteros en la unidad mínima de la moneda del taller.
 */

export type CostInput = {
  grams: number;
  colorsCount: number;
  purgeGrams: number;
  costPerGram: number;
  printMinutes: number;
  electricityCostPerHour: number;
  packagingCost: number;
  otherCosts?: number;
};

export type CostBreakdown = {
  totalGrams: number;
  materialCost: number;
  electricityCost: number;
  packagingCost: number;
  otherCosts: number;
  totalCost: number;
};

export function costPerGramFromKg(costPerKg: number): number {
  return costPerKg / 1000;
}

export function computePieceCost(input: CostInput): CostBreakdown {
  const totalGrams = input.grams + (input.colorsCount > 1 ? input.purgeGrams : 0);
  const materialCost = Math.round(totalGrams * input.costPerGram);
  const electricityCost = Math.round((input.printMinutes / 60) * input.electricityCostPerHour);
  const otherCosts = input.otherCosts ?? 0;
  return {
    totalGrams,
    materialCost,
    electricityCost,
    packagingCost: input.packagingCost,
    otherCosts,
    totalCost: materialCost + electricityCost + input.packagingCost + otherCosts,
  };
}

/** Precio que deja `targetMargin` (0 ≤ margen < 1) sobre el precio de venta. */
export function suggestPrice(totalCost: number, targetMargin: number): number {
  if (!(targetMargin >= 0 && targetMargin < 1)) throw new RangeError("El margen debe estar entre 0% y menos de 100%.");
  return Math.ceil(totalCost / (1 - targetMargin));
}

/** Comisión de Mercado Libre sugerida para un precio de venta (redondeada). */
export function suggestedMlCommission(salePrice: number, commissionPct: number): number {
  return Math.round((salePrice * commissionPct) / 100);
}

export function mercadoLibreNet(input: { salePrice: number; commissionPct: number; sellerShippingCost: number }): { commission: number; net: number } {
  const commission = suggestedMlCommission(input.salePrice, input.commissionPct);
  return { commission, net: input.salePrice - commission - input.sellerShippingCost };
}

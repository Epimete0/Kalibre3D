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

export type SpoolCostSample = {
  material: string;
  active: boolean;
  totalGrams: number;
  pricePaid: number;
};

/**
 * Calcula el costo por gramo de un material como el promedio ponderado (Σ pricePaid / Σ totalGrams)
 * de sus bobinas activas. Si no hay bobinas activas de ese material, usa `defaultCostPerKg / 1000` (D18).
 */
export function computeMaterialCostPerGram(
  spools: readonly SpoolCostSample[],
  material: string,
  defaultCostPerKg: number
): number {
  const activeMatching = spools.filter(
    (s) => s.active && s.material === material && s.totalGrams > 0 && s.pricePaid >= 0
  );
  if (activeMatching.length === 0) {
    return costPerGramFromKg(defaultCostPerKg);
  }
  const totalPaid = activeMatching.reduce((acc, s) => acc + s.pricePaid, 0);
  const totalGrams = activeMatching.reduce((acc, s) => acc + s.totalGrams, 0);
  if (totalGrams <= 0) {
    return costPerGramFromKg(defaultCostPerKg);
  }
  return totalPaid / totalGrams;
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

/**
 * Sugiere el precio entero a publicar en Mercado Libre para que después de la comisión porcentual
 * y el envío a cargo del vendedor quede al menos `targetNet`.
 */
export function suggestMlPriceForTargetNet(input: {
  targetNet: number;
  commissionPct: number;
  sellerShippingCost: number;
}): number {
  const { targetNet, commissionPct, sellerShippingCost } = input;
  if (!(commissionPct >= 0 && commissionPct < 100)) {
    throw new RangeError("La comisión de Mercado Libre debe estar entre 0% y menos de 100%.");
  }
  const requiredGross = Math.max(0, targetNet + sellerShippingCost);
  let candidate = Math.ceil(requiredGross / (1 - commissionPct / 100));
  // Ajustar por redondeo de la comisión entera
  while (
    candidate > 0 &&
    mercadoLibreNet({ salePrice: candidate - 1, commissionPct, sellerShippingCost }).net >= targetNet
  ) {
    candidate -= 1;
  }
  while (
    mercadoLibreNet({ salePrice: candidate, commissionPct, sellerShippingCost }).net < targetNet
  ) {
    candidate += 1;
  }
  return candidate;
}

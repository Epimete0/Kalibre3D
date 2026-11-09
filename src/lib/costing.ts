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

/** Costo de luz por hora de impresión a partir del precio del kWh y el consumo de la impresora en watts. */
export function electricityCostPerHourFromKwh(kwhPrice: number, printerWatts: number): number {
  if (!(kwhPrice > 0 && printerWatts > 0)) return 0;
  return Math.round((kwhPrice * printerWatts) / 1000);
}

/** Parte de IVA contenida en un precio que ya lo incluye (0 si no se considera IVA). */
export function vatIncluded(priceWithVat: number, vatPercent: number): number {
  if (!(vatPercent > 0) || priceWithVat <= 0) return 0;
  return Math.round((priceWithVat * vatPercent) / (100 + vatPercent));
}

export type DirectSaleBreakdown = {
  vat: number;
  extraCommission: number;
  profit: number;
  /** Ganancia sobre el precio sin IVA, en porcentaje entero. */
  marginPercent: number;
};

/** Desglose de una venta directa: IVA incluido, comisión adicional y ganancia real sobre el costo. */
export function directSaleBreakdown(input: {
  price: number;
  totalCost: number;
  vatPercent: number;
  extraCommissionPercent: number;
}): DirectSaleBreakdown {
  const vat = vatIncluded(input.price, input.vatPercent);
  const extraCommission = Math.round((input.price * input.extraCommissionPercent) / 100);
  const profit = input.price - vat - extraCommission - input.totalCost;
  const netOfVat = input.price - vat;
  return { vat, extraCommission, profit, marginPercent: netOfVat > 0 ? Math.round((profit / netOfVat) * 100) : 0 };
}

/**
 * Menor precio entero (con IVA incluido) que deja al menos `marginPercent` de ganancia sobre el precio sin IVA,
 * después de la comisión adicional. Sin IVA ni comisión equivale a `suggestPrice`.
 */
export function suggestDirectPrice(input: {
  totalCost: number;
  marginPercent: number;
  vatPercent: number;
  extraCommissionPercent: number;
}): number {
  const { totalCost, marginPercent, vatPercent, extraCommissionPercent } = input;
  if (!(marginPercent >= 0 && marginPercent < 100)) throw new RangeError("El margen debe estar entre 0% y menos de 100%.");
  const factor = (100 * (1 - marginPercent / 100)) / (100 + vatPercent) - extraCommissionPercent / 100;
  if (!(factor > 0)) throw new RangeError("El margen, el IVA y la comisión no dejan un precio posible.");
  if (totalCost <= 0) return 0;
  const reaches = (price: number) => {
    const { profit } = directSaleBreakdown({ price, totalCost, vatPercent, extraCommissionPercent });
    const netOfVat = price - vatIncluded(price, vatPercent);
    return netOfVat > 0 && profit >= (netOfVat * marginPercent) / 100;
  };
  let price = Math.max(1, Math.ceil(totalCost / factor));
  while (price > 1 && reaches(price - 1)) price -= 1;
  while (!reaches(price)) price += 1;
  return price;
}

/**
 * Precio a publicar en Mercado Libre para conservar lo mismo que deja la venta directa
 * (neto tras comisión y envío, menos el IVA incluido en el precio publicado).
 */
export function suggestMlPriceKeeping(input: {
  keepAfterVat: number;
  commissionPct: number;
  sellerShippingCost: number;
  vatPercent: number;
}): number {
  const { keepAfterVat, commissionPct, sellerShippingCost, vatPercent } = input;
  if (vatPercent <= 0) {
    return suggestMlPriceForTargetNet({ targetNet: keepAfterVat, commissionPct, sellerShippingCost });
  }
  const kept = (price: number) =>
    mercadoLibreNet({ salePrice: price, commissionPct, sellerShippingCost }).net - vatIncluded(price, vatPercent);
  const factor = 1 - commissionPct / 100 - vatPercent / (100 + vatPercent);
  if (!(factor > 0)) throw new RangeError("La comisión y el IVA no dejan un precio posible en Mercado Libre.");
  let price = Math.max(1, Math.ceil((Math.max(0, keepAfterVat) + sellerShippingCost) / factor));
  while (price > 1 && kept(price - 1) >= keepAfterVat) price -= 1;
  while (kept(price) < keepAfterVat) price += 1;
  return price;
}

/** Energía que consume una impresión: watts × minutos, en kWh (sin redondear). */
export function printEnergyKwh(printerWatts: number, printMinutes: number): number {
  if (!(printerWatts > 0 && printMinutes > 0)) return 0;
  return (printerWatts * printMinutes) / 60 / 1000;
}

import { mercadoLibreNet, suggestMlPriceForTargetNet } from "./costing";
import { unitPriceFor } from "./order-totals";

export type MlPriceInputMode = "PUBLISHED" | "NET";

export interface MlPricingSettings {
  mlCommissionPercent: number;
  mlDefaultShippingCost: number;
}

/**
 * Calcula el precio publicado sugerido en Mercado Libre para recibir un monto neto objetivo,
 * considerando la comisión (%) y el envío a cargo del taller del taller actual.
 */
export function computeMlPublishedFromNet(
  targetNet: number,
  settings: MlPricingSettings
): number {
  if (!Number.isFinite(targetNet) || targetNet <= 0) return 0;
  return suggestMlPriceForTargetNet({
    targetNet: Math.round(targetNet),
    commissionPct: settings.mlCommissionPercent,
    sellerShippingCost: settings.mlDefaultShippingCost,
  });
}

/**
 * Calcula el ingreso neto estimado y la comisión de Mercado Libre a partir de un precio publicado.
 */
export function computeMlNetFromPublished(
  publishedPrice: number,
  settings: MlPricingSettings
): { commission: number; net: number } {
  if (!Number.isFinite(publishedPrice) || publishedPrice <= 0) {
    return { commission: 0, net: 0 };
  }
  const result = mercadoLibreNet({
    salePrice: Math.round(publishedPrice),
    commissionPct: settings.mlCommissionPercent,
    sellerShippingCost: settings.mlDefaultShippingCost,
  });
  return {
    commission: Math.max(0, Math.round(result.commission)),
    net: Math.max(0, Math.round(result.net)),
  };
}

/**
 * Resuelve el precio unitario sugerido al seleccionar una pieza de catálogo en Nueva Venta,
 * respetando si el taller trabaja con precio publicado en ML o ingreso neto recibido directo.
 */
export function unitPriceForOrderChannel(
  product: { salePrice: number; mlPrice?: number | null },
  channel: string,
  mlPriceMode: MlPriceInputMode,
  settings: MlPricingSettings
): number {
  const isMl = channel === "MERCADOLIBRE";
  const baseUnitPrice = unitPriceFor(
    { salePrice: product.salePrice, mlPrice: product.mlPrice ?? null },
    isMl
  );
  if (!isMl || mlPriceMode === "PUBLISHED") {
    return baseUnitPrice;
  }
  if (product.mlPrice != null && product.mlPrice > 0) {
    return computeMlNetFromPublished(product.mlPrice, settings).net;
  }
  return baseUnitPrice;
}

/**
 * Etiquetas y valores cerrados para el catálogo de piezas, stock y bobinas de filamento (Fase 2).
 * Deben coincidir literalmente con los CHECK de la migración 20261109000000_phase2_catalog_spools_stock.
 */

export const MATERIALS = ["PLA", "PETG", "ASA", "ABS", "TPU", "OTHER"] as const;
export type Material = (typeof MATERIALS)[number];

export const MATERIAL_LABEL: Record<Material, string> = {
  PLA: "PLA",
  PETG: "PETG",
  ASA: "ASA",
  ABS: "ABS",
  TPU: "TPU",
  OTHER: "Otro material",
};

export const PRODUCT_MOVEMENT_KINDS = ["INITIAL", "ENTRY", "EXIT", "ADJUST"] as const;
export type ProductMovementKind = (typeof PRODUCT_MOVEMENT_KINDS)[number];

export const PRODUCT_MOVEMENT_LABEL: Record<ProductMovementKind, string> = {
  INITIAL: "Stock inicial",
  ENTRY: "Fabricación / Entrada",
  EXIT: "Salida / Entrega",
  ADJUST: "Ajuste de stock",
};

export const SPOOL_MOVEMENT_KINDS = ["INITIAL", "CONSUME", "ADJUST"] as const;
export type SpoolMovementKind = (typeof SPOOL_MOVEMENT_KINDS)[number];

export const SPOOL_MOVEMENT_LABEL: Record<SpoolMovementKind, string> = {
  INITIAL: "Peso inicial",
  CONSUME: "Consumo de impresión",
  ADJUST: "Ajuste de peso",
};

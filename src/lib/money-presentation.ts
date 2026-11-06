/** Categorías, métodos y etiquetas de dinero (deben coincidir con los CHECK de MoneyTransaction). */

export const INCOME_CATEGORIES = ["ORDER_PAYMENT", "DIGITAL_SALE", "OTHER_INCOME"] as const;
export const EXPENSE_CATEGORIES = ["FILAMENT", "PARTS", "SHIPPING", "ADVERTISING", "FEES", "REFUNDS", "UNEXPECTED", "OTHER_EXPENSE"] as const;
export const PAYMENT_METHODS = ["TRANSFER", "CASH", "MERCADOPAGO", "MERCADOLIBRE", "OTHER"] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type MoneyCategory = IncomeCategory | ExpenseCategory;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Categorías que se registran a mano en Dinero (los cobros y reembolsos nacen de una venta). */
export const MANUAL_INCOME_CATEGORIES = ["DIGITAL_SALE", "OTHER_INCOME"] as const;
export const MANUAL_EXPENSE_CATEGORIES = ["FILAMENT", "PARTS", "SHIPPING", "ADVERTISING", "FEES", "UNEXPECTED", "OTHER_EXPENSE"] as const;

export const CATEGORY_LABEL: Record<MoneyCategory, string> = {
  ORDER_PAYMENT: "Cobro de venta",
  DIGITAL_SALE: "Venta de archivos",
  OTHER_INCOME: "Otro ingreso",
  FILAMENT: "Filamento",
  PARTS: "Repuestos",
  SHIPPING: "Envíos",
  ADVERTISING: "Publicidad",
  FEES: "Comisiones",
  REFUNDS: "Devoluciones",
  UNEXPECTED: "Imprevistos",
  OTHER_EXPENSE: "Otro gasto",
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  MERCADOPAGO: "Mercado Pago",
  MERCADOLIBRE: "Mercado Libre",
  OTHER: "Otro",
};

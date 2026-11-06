/** Estados, canales y tipos de venta (onyx.md secciones 5 y 6). Módulo puro, compartido por servidor y cliente. */

export const ORDER_STATUSES = ["QUOTED", "CONFIRMED", "PRINTING", "READY", "DELIVERED", "CANCELED", "RETURNED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_CHANNELS = ["WHATSAPP", "INSTAGRAM", "IN_PERSON", "MERCADOLIBRE", "DIGITAL", "OTHER"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_KINDS = ["QUICK_SALE", "ORDER"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  QUOTED: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["PRINTING", "CANCELED"],
  PRINTING: ["READY", "CANCELED"],
  READY: ["DELIVERED", "CANCELED"],
  DELIVERED: ["RETURNED"],
  CANCELED: [],
  RETURNED: [],
};

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Estados que ya no cuentan como "pendientes" para atrasos y avisos. */
export function isClosedStatus(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELED" || status === "RETURNED";
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

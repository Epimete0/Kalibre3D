import type { OrderChannel, OrderKind, OrderStatus } from "./order-status";

/** Etiquetas visibles (español) de ventas y pedidos. */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  QUOTED: "Cotizado",
  CONFIRMED: "Confirmado",
  PRINTING: "Imprimiendo",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELED: "Cancelado",
  RETURNED: "Devuelto",
};

/** Texto del botón para avanzar a cada estado. */
export const STATUS_ACTION_LABEL: Record<OrderStatus, string> = {
  QUOTED: "Marcar como cotizado",
  CONFIRMED: "Confirmar",
  PRINTING: "Empezar a imprimir",
  READY: "Marcar como listo",
  DELIVERED: "Marcar como entregado",
  CANCELED: "Cancelar",
  RETURNED: "Registrar devolución",
};

export const CHANNEL_LABEL: Record<OrderChannel, string> = {
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  IN_PERSON: "En persona",
  MERCADOLIBRE: "Mercado Libre",
  DIGITAL: "Archivo digital",
  OTHER: "Otro",
};

export const KIND_LABEL: Record<OrderKind, string> = {
  QUICK_SALE: "Venta rápida",
  ORDER: "Pedido",
};

export function orderNumberLabel(number: number): string {
  return `Pedido #${number}`;
}

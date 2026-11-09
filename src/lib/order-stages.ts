import type { OrderStatus } from "./order-status";

/**
 * Etapas de un pedido por encargo en el orden en que avanza, con una explicación en lenguaje simple.
 * Sirve para mostrar dónde va el pedido y qué hacer a continuación, sin necesidad de que alguien lo explique.
 */
export const ORDER_STAGES = ["QUOTED", "CONFIRMED", "PRINTING", "READY", "DELIVERED"] as const satisfies readonly OrderStatus[];

export type OrderStage = (typeof ORDER_STAGES)[number];

/** Qué significa estar en cada etapa. */
export const STAGE_MEANING: Record<OrderStage, string> = {
  QUOTED: "Le diste el precio y esperas que el cliente acepte.",
  CONFIRMED: "El cliente aceptó. El pedido está en cola para imprimir.",
  PRINTING: "La pieza está en la impresora.",
  READY: "La pieza está lista y espera que la entregues.",
  DELIVERED: "El cliente ya tiene su pieza.",
};

/** Cuándo tocar el botón que lleva a cada etapa. */
export const STAGE_WHEN: Record<OrderStage, string> = {
  QUOTED: "",
  CONFIRMED: "Tócalo cuando el cliente acepte el precio.",
  PRINTING: "Tócalo cuando pongas la pieza a imprimir.",
  READY: "Tócalo cuando la pieza esté terminada.",
  DELIVERED: "Tócalo cuando el cliente reciba la pieza.",
};

export function isOrderStage(status: OrderStatus): status is OrderStage {
  return (ORDER_STAGES as readonly OrderStatus[]).includes(status);
}

/** Posición de la etapa actual (0 a 4) o -1 si el pedido está cancelado o devuelto. */
export function stageIndex(status: OrderStatus): number {
  return isOrderStage(status) ? ORDER_STAGES.indexOf(status) : -1;
}

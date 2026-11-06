import { todayInTimeZone } from "./money-summary";
import { isClosedStatus, type OrderChannel, type OrderStatus } from "./order-status";

/** Totales, saldo y atrasos de una venta (onyx.md sección 6, D3/D4). Módulo puro. */

export type ItemLine = { qty: number; unitPrice: number };

export function orderSubtotal(items: readonly ItemLine[]): number {
  return items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
}

export function orderTotal(items: readonly ItemLine[], discount: number): number {
  return Math.max(0, orderSubtotal(items) - discount);
}

/** Lo que el taller espera recibir: el total en canales directos, el neto en Mercado Libre. */
export function expectedReceivable(order: { channel: OrderChannel; total: number; mlCommission: number; mlShippingCost: number }): number {
  if (order.channel !== "MERCADOLIBRE") return order.total;
  return order.total - order.mlCommission - order.mlShippingCost;
}

export function orderBalance(expected: number, payments: readonly { amount: number; voided: boolean }[]): number {
  return expected - payments.reduce((sum, payment) => sum + (payment.voided ? 0 : payment.amount), 0);
}

/** Precio unitario de una pieza de la lista según si la venta es de Mercado Libre (D4). */
export function unitPriceFor(product: { salePrice: number; mlPrice: number | null }, isMercadoLibre: boolean): number {
  return isMercadoLibre && product.mlPrice !== null ? product.mlPrice : product.salePrice;
}

/** Atrasada: tiene fecha de entrega anterior a "hoy" en la zona del taller y no está terminada. */
export function isOverdue(order: { dueDate: string | null; status: OrderStatus }, now: Date, timeZone: string): boolean {
  if (!order.dueDate || isClosedStatus(order.status)) return false;
  return order.dueDate < todayInTimeZone(now, timeZone);
}

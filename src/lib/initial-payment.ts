/** Mercado Libre suele liberar el dinero después de la entrega. */
export function initialPaymentForChannel(channel: string): boolean {
  return channel !== "MERCADOLIBRE";
}

export function paymentAfterChannelChange(previous: string, next: string, current: boolean): boolean {
  return next === "MERCADOLIBRE" && previous !== next ? false : current;
}

export function paymentAfterKindChange(channel: string, kind: "QUICK_SALE" | "ORDER", current: boolean): boolean {
  return kind === "QUICK_SALE" && channel !== "MERCADOLIBRE" ? true : current;
}

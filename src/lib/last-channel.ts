import { ORDER_CHANNELS, type OrderChannel } from "@/lib/order-status";

/**
 * Último canal de venta usado en este navegador. Es solo una preferencia de interfaz (no se usa para
 * autorizar nada): se guarda en una cookie para que el formulario de Nueva venta llegue ya marcado desde el servidor.
 */
export const LAST_CHANNEL_COOKIE = "kalibre-last-channel";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Devuelve el canal guardado si es válido; si no, WhatsApp. */
export function parseLastChannel(value: string | undefined | null): OrderChannel {
  return ORDER_CHANNELS.find((channel) => channel === value) ?? "WHATSAPP";
}

/** Valor para `document.cookie` al cambiar de canal. */
export function lastChannelCookie(channel: OrderChannel): string {
  return `${LAST_CHANNEL_COOKIE}=${channel}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Comisión sugerida de Mercado Libre para un total, salvo que la persona la haya escrito a mano. */
export function effectiveMlCommission(total: number, commissionPercent: number, manualCommission: number | null): number {
  return manualCommission ?? Math.round((total * commissionPercent) / 100);
}

/** Guarda el canal en el navegador (solo se llama desde el cliente al elegir un canal). */
export function rememberLastChannel(channel: OrderChannel): void {
  if (typeof document === "undefined") return;
  document.cookie = lastChannelCookie(channel);
}

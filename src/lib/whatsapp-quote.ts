import { formatMoney, type Currency } from "@/lib/money-format";

export type WhatsAppQuoteInput = {
  workshopName?: string | null;
  pieceName?: string | null;
  material?: string | null;
  quantity: number;
  grams: number;
  colorsCount?: number;
  printMinutes: number;
  unitPrice: number;
  totalPrice: number;
  currency: Currency;
  channelLabel?: string | null;
  includeVat?: boolean;
};

export type WhatsAppOrderSummaryInput = {
  orderNumber: number | string;
  statusLabel: string;
  customerName: string;
  workshopName?: string | null;
  items: ReadonlyArray<{ title: string; quantity: number; lineTotal: number }>;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  currency: Currency;
  deliveryMethodLabel?: string | null;
  dueDateLabel?: string | null;
};

function formatDuration(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** Genera un mensaje limpio listo para pegar en WhatsApp desde una cotización (sin exponer costos internos). */
export function formatWhatsAppQuote(input: WhatsAppQuoteInput): string {
  const lines: string[] = [];
  const qty = Math.max(1, Math.round(input.quantity));
  const title = input.pieceName?.trim();

  lines.push("*Presupuesto de impresión 3D*");
  if (title && input.material) {
    lines.push(`Pieza: ${title} (${input.material})`);
  } else if (title) {
    lines.push(`Pieza: ${title}`);
  } else if (input.material) {
    lines.push(`Material: ${input.material}`);
  }

  lines.push(`Cantidad: ${qty} ${qty === 1 ? "unidad" : "unidades"}`);

  const specs: string[] = [];
  if (input.printMinutes > 0) specs.push(`Tiempo aprox.: ${formatDuration(input.printMinutes)}`);
  if (input.grams > 0) specs.push(`Peso: ${input.grams} g`);
  if (input.colorsCount && input.colorsCount > 1) specs.push(`${input.colorsCount} colores`);
  if (specs.length > 0) lines.push(specs.join(" · "));

  if (input.channelLabel) {
    lines.push(`Modalidad: ${input.channelLabel}`);
  }

  lines.push("");
  if (qty > 1) {
    lines.push(`*Valor unitario:* ${formatMoney(input.unitPrice, input.currency)}`);
  }
  lines.push(`*Total:* ${formatMoney(input.totalPrice, input.currency)}`);
  if (input.includeVat) {
    lines.push("Incluye IVA.");
  }
  if (input.workshopName?.trim()) {
    lines.push(`_${input.workshopName.trim()}_`);
  }

  return lines.join("\n");
}

/** Genera un resumen de pedido listo para compartir por WhatsApp con el cliente. */
export function formatWhatsAppOrderSummary(input: WhatsAppOrderSummaryInput): string {
  const lines: string[] = [];
  const greetingName = input.customerName.trim() || "cliente";

  lines.push(`Hola ${greetingName}, te comparto el detalle de tu pedido *#${input.orderNumber}*:`);
  lines.push(`Estado: ${input.statusLabel}`);
  if (input.deliveryMethodLabel) lines.push(`Entrega: ${input.deliveryMethodLabel}`);
  if (input.dueDateLabel) lines.push(`Fecha comprometida: ${input.dueDateLabel}`);

  if (input.items.length > 0) {
    lines.push("");
    for (const item of input.items) {
      lines.push(`• ${item.quantity} × ${item.title} — ${formatMoney(item.lineTotal, input.currency)}`);
    }
  }

  if (input.shippingCost > 0) {
    lines.push(`• Envío — ${formatMoney(input.shippingCost, input.currency)}`);
  }
  if (input.discountAmount > 0) {
    lines.push(`• Descuento — -${formatMoney(input.discountAmount, input.currency)}`);
  }

  lines.push("");
  lines.push(`*Total:* ${formatMoney(input.totalAmount, input.currency)}`);
  if (input.paidAmount > 0) {
    lines.push(`*Abonado:* ${formatMoney(input.paidAmount, input.currency)}`);
  }
  if (input.balanceDue > 0) {
    lines.push(`*Saldo pendiente:* ${formatMoney(input.balanceDue, input.currency)}`);
  } else {
    lines.push("*Estado de pago:* Pagado");
  }

  if (input.workshopName?.trim()) {
    lines.push(`_${input.workshopName.trim()}_`);
  }

  return lines.join("\n");
}

/** Construye URL de WhatsApp si el teléfono tiene al menos 8 dígitos; si no, null. */
export function buildWhatsAppChatUrl(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import { createOrder } from "@/lib/order-service";
import { createProduct } from "@/lib/product-service";

export type QuoteOrderActionResult =
  | { ok: true; message: string; data: { id: string; number: number } }
  | { ok?: false; error: string };

export type QuoteProductActionResult =
  | { ok: true; message: string; data: { id: string } }
  | { ok?: false; error: string };

export async function createQuotedOrderAction(input: {
  operationId: string;
  channel: "WHATSAPP" | "INSTAGRAM" | "IN_PERSON" | "MERCADOLIBRE" | "DIGITAL" | "OTHER";
  customerId?: string | null;
  newCustomerName?: string;
  newCustomerPhone?: string;
  newCustomerInstagram?: string;
  dueDate?: string | null;
  notes?: string | null;
  items: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    material: string | null;
    grams: number | null;
    colorsCount: number;
  }>;
}): Promise<QuoteOrderActionResult> {
  try {
    const created = await createOrder({
      operationId: input.operationId,
      kind: "ORDER",
      channel: input.channel,
      status: "QUOTED",
      customerId: input.customerId ?? null,
      newCustomerName: input.newCustomerName,
      newCustomerPhone: input.newCustomerPhone,
      newCustomerInstagram: input.newCustomerInstagram,
      dueDate: input.dueDate ?? null,
      discount: 0,
      notes: input.notes ?? null,
      items: input.items.map((item) => ({
        productId: null,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        material: item.material,
        grams: item.grams,
        colorsCount: item.colorsCount,
      })),
    });
    revalidatePath("/orders");
    revalidatePath("/dashboard");
    return {
      ok: true,
      message: "Cotización guardada como pedido correctamente.",
      data: created,
    };
  } catch (error) {
    return actionFailure(error, "No fue posible guardar la cotización como pedido. Intenta nuevamente.");
  }
}

export async function saveQuoteAsProductAction(
  formData: FormData
): Promise<QuoteProductActionResult> {
  try {
    const created = await createProduct(formData);
    revalidatePath("/products");
    revalidatePath("/orders/new");
    return {
      ok: true,
      message: "Pieza guardada en el catálogo correctamente.",
      data: { id: created.id },
    };
  } catch (error) {
    return actionFailure(error, "No fue posible guardar la pieza en el catálogo. Intenta nuevamente.");
  }
}

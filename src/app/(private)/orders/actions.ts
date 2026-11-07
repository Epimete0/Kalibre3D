"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { createOrder } from "@/lib/order-service";

type CreateOrderState = {
  error?: string;
  message?: string;
  orderId?: string;
};

export async function createOrderAction(
  _state: CreateOrderState,
  payload: unknown
): Promise<CreateOrderState> {
  let createdOrderId: string | null = null;
  try {
    const result = await createOrder(payload);
    createdOrderId = result.id;
    revalidatePath("/orders");
    revalidatePath("/clients");
    revalidatePath("/dashboard");
  } catch (error) {
    return actionFailure(error, "No fue posible registrar la venta. Intenta nuevamente.");
  }

  if (createdOrderId) {
    redirect(`/orders`);
  }

  return {};
}

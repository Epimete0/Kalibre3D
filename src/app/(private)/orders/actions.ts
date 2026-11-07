"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { changeOrderStatus, createOrder } from "@/lib/order-service";
import type { OrderStatus } from "@/lib/order-status";

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
    redirect(`/orders/${createdOrderId}`);
  }

  return {};
}

export type ChangeOrderStatusState = {
  error?: string;
  message?: string;
};

export async function changeOrderStatusAction(input: {
  orderId: string;
  expectedVersion: number;
  to: OrderStatus;
}): Promise<ChangeOrderStatusState> {
  try {
    await changeOrderStatus(input);
    revalidatePath("/orders");
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { message: "Estado de pedido actualizado correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible actualizar el estado del pedido. Intenta nuevamente.");
  }
}

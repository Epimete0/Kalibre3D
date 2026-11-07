"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import type { PaymentMethod } from "@/lib/money-presentation";
import {
  changeOrderStatus,
  createOrder,
  registerPayment,
  returnOrder,
  voidMoneyTransaction,
} from "@/lib/order-service";
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

export type OrderMutationState = {
  error?: string;
  message?: string;
};

export async function changeOrderStatusAction(input: {
  orderId: string;
  expectedVersion: number;
  to: OrderStatus;
}): Promise<OrderMutationState> {
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

export async function registerPaymentAction(input: {
  orderId: string;
  operationId: string;
  amount: number;
  method: PaymentMethod;
  occurredOn?: string;
  notes?: string | null;
}): Promise<OrderMutationState> {
  try {
    await registerPayment(input);
    revalidatePath("/orders");
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { message: "Cobro registrado correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible registrar el cobro. Intenta nuevamente.");
  }
}

export async function voidMoneyTransactionAction(input: {
  orderId: string;
  transactionId: string;
  reason: string;
}): Promise<OrderMutationState> {
  try {
    await voidMoneyTransaction({
      transactionId: input.transactionId,
      reason: input.reason,
    });
    revalidatePath("/orders");
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { message: "Movimiento anulado correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible anular el movimiento. Intenta nuevamente.");
  }
}

export async function returnOrderAction(input: {
  orderId: string;
  expectedVersion: number;
  operationId: string;
  refundAmount: number;
  method: PaymentMethod;
  occurredOn?: string;
  notes?: string | null;
}): Promise<OrderMutationState> {
  try {
    await returnOrder(input);
    revalidatePath("/orders");
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { message: "Devolución registrada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible registrar la devolución. Intenta nuevamente.");
  }
}

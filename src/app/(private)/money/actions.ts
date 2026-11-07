"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import type { PaymentMethod } from "@/lib/money-presentation";
import {
  recordManualMoneyTransaction,
  voidManualMoneyTransaction,
} from "@/lib/money-service";

export type MoneyMutationState = {
  error?: string;
  message?: string;
};

export async function recordManualMoneyAction(input: {
  operationId: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  method: PaymentMethod;
  occurredOn?: string;
  notes?: string | null;
}): Promise<MoneyMutationState> {
  try {
    await recordManualMoneyTransaction(input);
    revalidatePath("/money");
    revalidatePath("/dashboard");
    return {
      message:
        input.type === "EXPENSE"
          ? "Gasto registrado correctamente."
          : "Ingreso registrado correctamente.",
    };
  } catch (error) {
    return actionFailure(
      error,
      input.type === "EXPENSE"
        ? "No fue posible registrar el gasto. Intenta nuevamente."
        : "No fue posible registrar el ingreso. Intenta nuevamente."
    );
  }
}

export async function voidMoneyAction(input: {
  transactionId: string;
  reason: string;
}): Promise<MoneyMutationState> {
  try {
    await voidManualMoneyTransaction(input);
    revalidatePath("/money");
    revalidatePath("/orders");
    revalidatePath("/clients");
    revalidatePath("/dashboard");
    return { message: "Movimiento anulado correctamente." };
  } catch (error) {
    return actionFailure(
      error,
      "No fue posible anular el movimiento. Intenta nuevamente."
    );
  }
}

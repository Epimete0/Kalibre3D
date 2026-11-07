"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import { createCustomer, deleteCustomer, setCustomerActive, updateCustomer } from "@/lib/customer-service";

type State = { error?: string; message?: string; customerId?: string };

export async function createCustomerAction(_state: State, data: FormData): Promise<State> {
  try {
    const item = await createCustomer(data);
    revalidatePath("/clients");
    return { message: `Cliente "${item.name}" creado correctamente.`, customerId: item.id };
  } catch (error) {
    return actionFailure(error, "No fue posible crear el cliente. Intenta nuevamente.");
  }
}

export async function updateCustomerAction(_state: State, data: FormData): Promise<State> {
  try {
    await updateCustomer(data);
    revalidatePath("/clients");
    const id = String(data.get("id") ?? "");
    if (id) {
      revalidatePath(`/clients/${id}`);
    }
    return { message: "Cliente actualizado correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible actualizar el cliente. Intenta nuevamente.");
  }
}

export async function setCustomerActiveAction(_state: State, data: FormData): Promise<State> {
  try {
    const result = await setCustomerActive(data);
    revalidatePath("/clients");
    revalidatePath(`/clients/${result.id}`);
    return {
      message: result.active
        ? "Cliente activado correctamente."
        : "Cliente desactivado correctamente.",
    };
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el estado del cliente. Intenta nuevamente.");
  }
}

export async function deleteCustomerAction(_state: State, data: FormData): Promise<State> {
  try {
    await deleteCustomer(data);
    revalidatePath("/clients");
    return { message: "Cliente eliminado correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible eliminar el cliente. Intenta nuevamente.");
  }
}

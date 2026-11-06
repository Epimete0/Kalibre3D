"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import { createProduct, deleteProduct, setProductActive, updateProduct } from "@/lib/product-service";

type State = { error?: string; message?: string };

export async function createProductAction(_state: State, data: FormData): Promise<State> {
  try {
    const item = await createProduct(data);
    revalidatePath("/products");
    return { message: `Pieza "${item.name}" creada correctamente.` };
  } catch (error) {
    return actionFailure(error, "No fue posible crear la pieza. Intenta nuevamente.");
  }
}

export async function updateProductAction(_state: State, data: FormData): Promise<State> {
  try {
    const item = await updateProduct(data);
    revalidatePath("/products");
    return { message: `Pieza "${item.name}" actualizada correctamente.` };
  } catch (error) {
    return actionFailure(error, "No fue posible actualizar la pieza. Intenta nuevamente.");
  }
}

export async function setProductActiveAction(_state: State, data: FormData): Promise<State> {
  try {
    const result = await setProductActive(data);
    revalidatePath("/products");
    return { message: result.active ? "Pieza reactivada correctamente." : "Pieza desactivada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el estado de la pieza. Intenta nuevamente.");
  }
}

export async function deleteProductAction(_state: State, data: FormData): Promise<State> {
  try {
    await deleteProduct(data);
    revalidatePath("/products");
    return { message: "Pieza eliminada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible eliminar la pieza. Intenta nuevamente.");
  }
}

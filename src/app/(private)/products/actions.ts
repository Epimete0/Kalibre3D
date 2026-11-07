"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import {
  createProduct,
  deleteProduct,
  recordProductMovement,
  setProductActive,
  updateProduct,
  type RecordProductMovementInput,
} from "@/lib/product-service";

export type ProductActionState = { ok?: boolean; error?: string; message?: string };

export async function createProductAction(_state: ProductActionState, data: FormData): Promise<ProductActionState> {
  try {
    const item = await createProduct(data);
    revalidatePath("/products");
    revalidatePath("/orders/new");
    revalidatePath("/dashboard");
    return { ok: true, message: `Pieza "${item.name}" creada correctamente.` };
  } catch (error) {
    return actionFailure(error, "No fue posible crear la pieza. Intenta nuevamente.");
  }
}

export async function updateProductAction(_state: ProductActionState, data: FormData): Promise<ProductActionState> {
  try {
    const item = await updateProduct(data);
    revalidatePath("/products");
    revalidatePath(`/products/${item.id}`);
    revalidatePath("/orders/new");
    return { ok: true, message: `Pieza "${item.name}" actualizada correctamente.` };
  } catch (error) {
    return actionFailure(error, "No fue posible actualizar la pieza. Intenta nuevamente.");
  }
}

export async function setProductActiveAction(_state: ProductActionState, data: FormData): Promise<ProductActionState> {
  try {
    const result = await setProductActive(data);
    revalidatePath("/products");
    revalidatePath(`/products/${result.id}`);
    revalidatePath("/orders/new");
    return { ok: true, message: result.active ? "Pieza reactivada correctamente." : "Pieza desactivada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el estado de la pieza. Intenta nuevamente.");
  }
}

export async function deleteProductAction(_state: ProductActionState, data: FormData): Promise<ProductActionState> {
  try {
    await deleteProduct(data);
    revalidatePath("/products");
    revalidatePath("/orders/new");
    return { ok: true, message: "Pieza eliminada correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible eliminar la pieza. Intenta nuevamente.");
  }
}

export async function recordProductMovementAction(input: {
  operationId: string;
  productId: string;
  kind: "ENTRY" | "EXIT" | "ADJUST";
  delta: number;
  notes?: string;
}): Promise<ProductActionState> {
  try {
    await recordProductMovement({
      operationId: input.operationId,
      productId: input.productId,
      kind: input.kind as RecordProductMovementInput["kind"],
      delta: input.delta,
      notes: input.notes ?? null,
    });
    revalidatePath("/products");
    revalidatePath(`/products/${input.productId}`);
    revalidatePath("/dashboard");
    return { ok: true, message: "Stock actualizado correctamente." };
  } catch (error) {
    return actionFailure(error, "No fue posible actualizar el stock. Intenta nuevamente.");
  }
}

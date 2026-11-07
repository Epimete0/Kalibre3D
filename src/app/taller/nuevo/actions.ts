"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { CENTER_COOKIE, CENTER_COOKIE_OPTIONS } from "@/lib/auth";
import { createCenter } from "@/lib/center-creation";

export type CreateCenterState = { error?: string };

/** Crea el taller propio de la persona, lo deja como taller activo y la lleva al primer paso del inicio guiado (sus costos). */
export async function createCenterAction(_state: CreateCenterState, formData: FormData): Promise<CreateCenterState> {
  let centerId: string;
  try {
    centerId = (await createCenter(formData)).centerId;
    (await cookies()).set(CENTER_COOKIE, centerId, CENTER_COOKIE_OPTIONS);
  } catch (error) {
    return { error: actionFailure(error, "No fue posible crear el taller. Intenta nuevamente.").error };
  }
  revalidatePath("/", "layout");
  // Inicio guiado: primero los costos (opcionales), luego la primera bobina y la primera venta.
  redirect("/settings?bienvenida=1");
}

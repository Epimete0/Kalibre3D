"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { CENTER_COOKIE } from "@/lib/auth";
import { createCenter } from "@/lib/center-creation";

export type CreateCenterState = { error?: string };

/** Crea el taller propio de la persona, lo deja como taller activo y la lleva a Inicio (donde la guía de primeros pasos la espera). */
export async function createCenterAction(_state: CreateCenterState, formData: FormData): Promise<CreateCenterState> {
  let centerId: string;
  try {
    centerId = (await createCenter(formData)).centerId;
    (await cookies()).set(CENTER_COOKIE, centerId, { httpOnly: true, sameSite: "lax", path: "/" });
  } catch (error) {
    return { error: actionFailure(error, "No fue posible crear el taller. Intenta nuevamente.").error };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

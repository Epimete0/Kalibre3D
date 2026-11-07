"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { updateCenterSettings } from "@/lib/center-settings-service";

type State = { error?: string; message?: string };

export async function saveCenterSettingsAction(_state: State, data: FormData): Promise<State> {
  try {
    await updateCenterSettings(data);
  } catch (error) {
    return actionFailure(error, "No fue posible guardar los ajustes del taller. Intenta nuevamente.");
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  // En el inicio guiado, después de los costos sigue la primera bobina (destino fijo, no viene del cliente).
  if (data.get("welcome") === "1") redirect("/spools?nueva=1&bienvenida=1");
  return { message: "Ajustes del taller actualizados correctamente." };
}

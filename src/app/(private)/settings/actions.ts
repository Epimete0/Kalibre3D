"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { updateCenterSettings } from "@/lib/center-settings-service";

type State = { error?: string; message?: string };

export async function saveCenterSettingsAction(_state: State, data: FormData): Promise<State> {
  let enableSpools = true;
  try {
    const updated = await updateCenterSettings(data);
    enableSpools = updated.enableSpools;
  } catch (error) {
    return actionFailure(error, "No fue posible guardar los ajustes del taller. Intenta nuevamente.");
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  // En el inicio guiado, si el taller activó bobinas sigue con su primera bobina; si eligió modo simple va directo a registrar venta.
  if (data.get("welcome") === "1") {
    redirect(enableSpools ? "/spools?nueva=1&bienvenida=1" : "/orders/new");
  }
  return { message: "Costos del taller guardados correctamente." };
}

"use server";

import { revalidatePath } from "next/cache";
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
  return { message: "Ajustes del taller actualizados correctamente." };
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure } from "@/lib/action-failure";
import { parsePasswordChange, resolveSelectableCenter, updateCenterSettings, updateDisplayName } from "@/lib/account-service";
import { CENTER_COOKIE, requireSessionUser } from "@/lib/auth";
import { DomainError } from "@/lib/action-errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readAuthAutoconfirm } from "@/lib/auth-settings";
import { emailChangeSentMessage, requestEmailChange } from "@/lib/email-change";

type State = { error?: string; message?: string };

export async function saveDisplayNameAction(_state: State, data: FormData): Promise<State> {
  try {
    await updateDisplayName(data);
  } catch (error) {
    return actionFailure(error, "No fue posible guardar tu nombre. Intenta nuevamente.");
  }
  revalidatePath("/", "layout"); // el nombre aparece en el menú, el equipo y los pedidos
  return { message: "Nombre actualizado correctamente." };
}

export async function changePasswordAction(_state: State, data: FormData): Promise<State> {
  try {
    const password = parsePasswordChange(data);
    await requireSessionUser();
    const { error } = await (await createSupabaseServerClient()).auth.updateUser({ password });
    if (error) throw new DomainError("No fue posible cambiar la contraseña. Usa una distinta de la actual y de al menos 8 caracteres.");
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar la contraseña. Intenta nuevamente.");
  }
  return { message: "Contraseña actualizada correctamente." };
}

/** Pide cambiar el correo de acceso: se confirma desde el correo nuevo y no cambia hasta entonces. */
export async function changeEmailAction(_state: State, data: FormData): Promise<State> {
  try {
    await requireSessionUser();
    const supabase = await createSupabaseServerClient();
    const { data: current } = await supabase.auth.getUser();
    const { email } = await requestEmailChange(data.get("email"), current.user?.email, {
      readAutoconfirm: readAuthAutoconfirm,
      updateUser: async (email, emailRedirectTo) => {
        const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo });
        return { error: error ? { code: error.code, status: error.status } : null };
      },
    });
    revalidatePath("/profile");
    return { message: emailChangeSentMessage(email) };
  } catch (error) {
    return actionFailure(error, "No fue posible solicitar el cambio de correo. Intenta nuevamente.");
  }
}

/** Nombre y zona horaria del taller (solo OWNER y ADMIN; los servicios lo vuelven a exigir). */
export async function saveCenterAction(_state: State, data: FormData): Promise<State> {
  try {
    await updateCenterSettings(data);
  } catch (error) {
    return actionFailure(error, "No fue posible guardar los datos del taller. Intenta nuevamente.");
  }
  revalidatePath("/", "layout");
  return { message: "Datos del taller actualizados correctamente." };
}

/** Cambia el taller activo entre los que la persona tiene activos. */
export async function switchCenterAction(_state: State, data: FormData): Promise<State> {
  try {
    const centerId = await resolveSelectableCenter(data);
    (await cookies()).set(CENTER_COOKIE, centerId, { httpOnly: true, sameSite: "lax", path: "/" });
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el taller. Intenta nuevamente.");
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

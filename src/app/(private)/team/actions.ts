"use server";

import { revalidatePath } from "next/cache";
import { actionFailure } from "@/lib/action-failure";
import { createInvitation, revokeInvitation } from "@/lib/invitation-admin-service";
import { changeMemberRole, setMemberActive } from "@/lib/member-service";

export type TeamActionState = { error?: string; message?: string; code?: string; expiresAt?: string };

function refresh() {
  revalidatePath("/team");
  revalidatePath("/agenda"); // quién atiende y quién está activo cambia la agenda
  revalidatePath("/dashboard");
}

export async function changeRoleAction(_state: TeamActionState, data: FormData): Promise<TeamActionState> {
  try {
    await changeMemberRole(String(data.get("userId") ?? ""), String(data.get("role") ?? ""));
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el rol. Intenta nuevamente.");
  }
  refresh();
  return { message: "Rol actualizado correctamente." };
}

export async function setMemberActiveAction(_state: TeamActionState, data: FormData): Promise<TeamActionState> {
  const active = data.get("active") === "true";
  try {
    await setMemberActive(String(data.get("userId") ?? ""), active);
  } catch (error) {
    return actionFailure(error, "No fue posible cambiar el estado de la persona. Intenta nuevamente.");
  }
  refresh();
  if (active) return { message: "Persona reactivada correctamente." };
  return { message: "Persona desactivada correctamente." };
}

export async function createInvitationAction(_state: TeamActionState, data: FormData): Promise<TeamActionState> {
  let created: Awaited<ReturnType<typeof createInvitation>>;
  try {
    created = await createInvitation(String(data.get("role") ?? ""));
  } catch (error) {
    return actionFailure(error, "No fue posible crear la invitación. Intenta nuevamente.");
  }
  refresh();
  // El código solo viaja aquí, una vez: en la base queda únicamente su huella.
  return { message: "Invitación creada correctamente.", code: created.code, expiresAt: created.expiresAt.toISOString() };
}

export async function revokeInvitationAction(_state: TeamActionState, data: FormData): Promise<TeamActionState> {
  try {
    await revokeInvitation(String(data.get("id") ?? ""));
  } catch (error) {
    return actionFailure(error, "No fue posible revocar la invitación. Intenta nuevamente.");
  }
  refresh();
  return { message: "Invitación revocada correctamente." };
}

"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { CENTER_COOKIE, requireSessionUser } from "@/lib/auth";
import { safeActionError } from "@/lib/action-errors";
import { redeemInvitation } from "@/lib/invitation-service";
import { hashInvitationCode } from "@/lib/invitation-admin-service";

export type JoinState = { error?: string; message?: string };

export async function redeemInvitationAction(_state: JoinState, formData: FormData): Promise<JoinState> {
  const code = z.string().trim().min(1, "Ingresa el código de invitación.").safeParse(formData.get("code"));
  if (!code.success) return { error: code.error.issues[0]?.message };
   const userId = await requireSessionUser();
  // Acepta el código con o sin guiones y en minúsculas: se normaliza igual que al crearlo.
  const codeHash = hashInvitationCode(code.data);
  try {
     const center = await redeemInvitation({ userId, codeHash });
    (await cookies()).set(CENTER_COOKIE, center, { httpOnly: true, sameSite: "lax", path: "/" });
  } catch (error) { return { error: safeActionError(error, "No fue posible canjear el código. Intenta nuevamente.") }; }
  return { message: "Te uniste al taller correctamente." };
}

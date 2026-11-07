"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createHash } from "node:crypto";
import { CENTER_COOKIE } from "@/lib/auth";
import { resolveActiveMembership } from "@/lib/auth";
import { ensureProfile, isInvitationUsable, profileExists } from "@/lib/signup-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeActionError } from "@/lib/action-errors";
import { isExistingSupabaseAccountError, isSupabaseRateLimitError, mapSupabaseAuthError, mapSupabaseLoginError, mapSupabasePasswordError, mapSupabaseSignupError } from "@/lib/auth-errors";
import { redeemInvitation } from "@/lib/invitation-service";
import { ACCEPT_TERMS_ERROR, TERMS_VERSION, hasAcceptedTerms } from "@/lib/legal";

export type AuthFormState = { error?: string; message?: string };
const credentials = z.object({ email: z.string().trim().email("Ingresa un correo válido."), password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.") });
const signupConfirmationMessage = "Si el correo existe, recibirás un enlace para confirmar la cuenta.";

function parse(formData: FormData) {
  return credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
}

async function authRedirect(path: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin");
  if (!siteUrl) throw new Error("Falta NEXT_PUBLIC_SITE_URL para configurar la autenticación");
  return new URL(path, siteUrl).toString();
}

export async function loginAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = parse(formData);
  if (!input.success) return { error: input.error.issues[0]?.message };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(input.data);
  if (error || !data.user) return { error: mapSupabaseLoginError(error) };
  const requestedCenterId = (await cookies()).get(CENTER_COOKIE)?.value;
  const membership = await resolveActiveMembership(data.user.id, requestedCenterId);
  if (!membership) {
    (await cookies()).delete(CENTER_COOKIE);
    redirect("/dashboard");
  }
  (await cookies()).set(CENTER_COOKIE, membership.centerId, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function signupAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const input = parse(formData);
  const displayName = String(formData.get("displayName") ?? "").trim();
  const invitationCode = String(formData.get("invitationCode") ?? "").trim().toUpperCase();
  if (!input.success) return { error: input.error.issues[0]?.message };
  // Sin aceptación no se crea nada (ni la cuenta ni el correo de confirmación): el navegador la exige, pero el servidor no confía en eso.
  if (!hasAcceptedTerms(formData.get("acceptTerms"))) return { error: ACCEPT_TERMS_ERROR };
  const invitationHash = invitationCode ? createHash("sha256").update(invitationCode).digest("hex") : undefined;
  if (invitationHash && !(await isInvitationUsable(invitationHash))) return { error: "El código de invitación no es válido o ya venció." };
  const supabase = await createSupabaseServerClient();
  let redirectTo: string;
  try { redirectTo = await authRedirect(`/auth/callback?next=${invitationCode ? "/dashboard" : "/taller/nuevo"}`); } catch (error) { return { error: safeActionError(error, "No fue posible preparar la confirmación. Intenta más tarde.") }; }
  const { data, error } = await supabase.auth.signUp({ email: input.data.email, password: input.data.password, options: { data: { displayName, acceptedTermsAt: new Date().toISOString(), termsVersion: TERMS_VERSION }, emailRedirectTo: redirectTo } });
  if (error || !data.user) {
    if (isExistingSupabaseAccountError(error)) return { message: signupConfirmationMessage };
    return { error: mapSupabaseSignupError(error) };
  }
  if (data.user.identities?.length === 0) return { message: signupConfirmationMessage };
  let centerId: string | undefined;
  try {
    if (await profileExists(data.user.id)) return { message: signupConfirmationMessage };
    if (invitationCode) centerId = await redeemInvitation({ userId: data.user.id, codeHash: invitationHash!, profileData: { displayName } });
    else await ensureProfile(data.user.id, displayName);
  } catch (error) {
    console.error("Signup profile or membership transaction failed", error);
    try {
       await ensureProfile(data.user.id, displayName);
    } catch (retryError) {
      console.error("Signup profile retry failed", retryError);
      return { error: "Tu cuenta fue creada, pero no pudimos completar la configuración. Inicia sesión y vuelve a intentarlo o contacta al administrador." };
    }
    return { error: "Tu cuenta fue creada, pero no pudimos completar la configuración. Inicia sesión y vuelve a intentarlo o contacta al administrador." };
  }
   if (centerId) (await cookies()).set(CENTER_COOKIE, centerId, { httpOnly: true, sameSite: "lax", path: "/" });
  if (!data.session) return { message: "Revisa tu correo para confirmar la cuenta y luego inicia sesión." };
  // Con invitación ya pertenece a un taller; sin ella el siguiente paso es crear el suyo.
  redirect(centerId ? "/dashboard" : "/taller/nuevo");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  (await cookies()).delete(CENTER_COOKIE);
  redirect("/");
}

export async function requestPasswordResetAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = z.string().trim().email("Ingresa un correo válido.").safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0]?.message };
  let redirectTo: string;
  try { redirectTo = await authRedirect("/auth/callback?next=/reset-password"); } catch (error) { return { error: safeActionError(error, "No fue posible preparar el enlace de recuperación. Intenta más tarde.") }; }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo });
  if (error) {
    if (isSupabaseRateLimitError(error)) return { message: "Si el correo existe, recibirás un enlace para cambiar tu contraseña." };
    return { error: mapSupabaseAuthError(error) };
  }
  return { message: "Si el correo existe, recibirás un enlace para cambiar tu contraseña." };
}

export async function updatePasswordAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const password = z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").safeParse(formData.get("password"));
  if (!password.success) return { error: password.error.issues[0]?.message };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: mapSupabasePasswordError(error) };
  return { message: "Contraseña actualizada. Ya puedes iniciar sesión." };
}

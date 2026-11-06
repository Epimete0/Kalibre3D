import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { siteUrl } from "@/lib/site-url";

/**
 * Cambio del correo de acceso. El correo ES el inicio de sesión, por eso nunca se aplica sin confirmación:
 * si el servicio de autenticación tiene la confirmación por correo desactivada (`mailer_autoconfirm`),
 * Supabase cambiaría el correo al instante, así que la solicitud se rechaza antes de pedirla.
 */

export const EMAIL_MAX = 254;

const emailSchema = z.string({ error: "Escribe el correo nuevo." }).trim().toLowerCase()
  .min(1, "Escribe el correo nuevo.").max(EMAIL_MAX, "El correo es demasiado largo.").email("El correo no es válido.");

export function parseNewEmail(raw: unknown, currentEmail: string | null | undefined): string {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "El correo no es válido.");
  if (currentEmail && parsed.data === currentEmail.trim().toLowerCase()) throw new DomainError("Ese ya es tu correo de acceso.");
  return parsed.data;
}

export type EmailChangeDeps = {
  /** `true` si el servicio aplicaría el cambio sin confirmación; `null` si no se pudo saber. */
  readAutoconfirm: () => Promise<boolean | null>;
  updateUser: (email: string, emailRedirectTo: string) => Promise<{ error: { code?: string; status?: number } | null }>;
};

/** Pide el cambio. Devuelve el correo nuevo ya normalizado, listo para decir a dónde se envió la confirmación. */
export async function requestEmailChange(raw: unknown, currentEmail: string | null | undefined, deps: EmailChangeDeps): Promise<{ email: string }> {
  const email = parseNewEmail(raw, currentEmail);
  const autoconfirm = await deps.readAutoconfirm();
  if (autoconfirm !== false) throw new DomainError("El cambio de correo todavía no está disponible: requiere que la confirmación por correo esté activada.");
  const { error } = await deps.updateUser(email, `${siteUrl()}/auth/callback?next=/profile`);
  if (error) {
    if (error.code === "over_email_send_rate_limit" || error.status === 429) throw new DomainError("Se enviaron demasiados correos. Intenta de nuevo en unos minutos.");
    // Un correo ya registrado produce el mismo mensaje que cualquier otro fallo: no revela si existe una cuenta.
    throw new DomainError("No fue posible solicitar el cambio de correo. Revisa el correo e intenta nuevamente.");
  }
  return { email };
}

export const emailChangeSentMessage = (email: string) => `Te enviamos un correo de confirmación a ${email}. Tu correo de acceso no cambia hasta que lo confirmes.`;

import "server-only";

/**
 * Lee la configuración pública del servicio de autenticación: `true` si aplicaría un cambio de correo sin
 * confirmación (`mailer_autoconfirm`). `null` cuando no se pudo saber: quien llama debe tratarlo como «no disponible».
 */
export async function readAuthAutoconfirm(): Promise<boolean | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const settings = (await response.json()) as { mailer_autoconfirm?: unknown };
    return typeof settings.mailer_autoconfirm === "boolean" ? settings.mailer_autoconfirm : null;
  } catch {
    return null;
  }
}

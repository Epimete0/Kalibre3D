type SupabaseAuthError = { code?: string; status?: number; name?: string; message?: string } | null | undefined;

export function mapSupabaseAuthError(error: SupabaseAuthError): string {
  const code = error?.code?.toLowerCase();
  const name = error?.name?.toLowerCase();

  if (code === "invalid_credentials" || code === "invalid_login_credentials") return "Correo o contraseña incorrectos.";
  if (code === "weak_password" || name === "authweakpassworderror") return "La contraseña no cumple los requisitos de seguridad configurados.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error?.status === 429) return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  if (code === "captcha_failed") return "Completa la verificación de seguridad e inténtalo nuevamente.";
  if (["session_not_found", "invalid_token", "refresh_token_not_found"].includes(code ?? "")) return "La sesión o el enlace de recuperación venció. Inicia sesión o solicita uno nuevo.";
  return "No fue posible autenticarte. Intenta nuevamente.";
}

export function mapSupabaseLoginError(error: SupabaseAuthError): string {
  const message = mapSupabaseAuthError(error);
  return message === "No fue posible autenticarte. Intenta nuevamente." ? "No fue posible conectar con el servicio de acceso. Intenta nuevamente." : message;
}

export function mapSupabasePasswordError(error: SupabaseAuthError): string {
  const message = mapSupabaseAuthError(error);
  return message === "No fue posible autenticarte. Intenta nuevamente." ? "No fue posible actualizar la contraseña. Intenta nuevamente." : message;
}

export function mapSupabaseSignupError(error: SupabaseAuthError): string {
  const message = mapSupabaseAuthError(error);
  return message === "No fue posible autenticarte. Intenta nuevamente." ? "No fue posible crear la cuenta. Intenta nuevamente." : message;
}

export function isExistingSupabaseAccountError(error: SupabaseAuthError): boolean {
  return ["user_already_exists", "email_exists"].includes(error?.code?.toLowerCase() ?? "");
}

export function isSupabaseRateLimitError(error: SupabaseAuthError): boolean {
  const code = error?.code?.toLowerCase();
  return code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || error?.status === 429;
}

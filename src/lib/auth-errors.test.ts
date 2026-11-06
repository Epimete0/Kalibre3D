import { describe, expect, it } from "vitest";
import { isExistingSupabaseAccountError, isSupabaseRateLimitError, mapSupabaseAuthError } from "./auth-errors";

describe("Supabase auth errors", () => {
  it("maps known errors from structured provider metadata", () => {
    expect(mapSupabaseAuthError({ code: "invalid_credentials" })).toBe("Correo o contraseña incorrectos.");
    expect(mapSupabaseAuthError({ code: "weak_password" })).toBe("La contraseña no cumple los requisitos de seguridad configurados.");
    expect(mapSupabaseAuthError({ name: "AuthWeakPasswordError" })).toBe("La contraseña no cumple los requisitos de seguridad configurados.");
    expect(mapSupabaseAuthError({ code: "over_request_rate_limit" })).toBe("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
    expect(mapSupabaseAuthError({ status: 429 })).toBe("Demasiados intentos. Espera unos minutos antes de volver a intentarlo.");
    expect(mapSupabaseAuthError({ code: "captcha_failed" })).toBe("Completa la verificación de seguridad e inténtalo nuevamente.");
    expect(mapSupabaseAuthError({ code: "invalid_token" })).toBe("La sesión o el enlace de recuperación venció. Inicia sesión o solicita uno nuevo.");
  });

  it("does not expose unknown provider messages", () => {
    expect(mapSupabaseAuthError({ code: "unknown", message: "internal provider detail" })).toBe("No fue posible autenticarte. Intenta nuevamente.");
  });

  it("identifies account-existence and rate-limit outcomes without using provider messages", () => {
    expect(isExistingSupabaseAccountError({ code: "user_already_exists" })).toBe(true);
    expect(isExistingSupabaseAccountError({ code: "email_exists" })).toBe(true);
    expect(isExistingSupabaseAccountError({ message: "User already registered" })).toBe(false);
    expect(isSupabaseRateLimitError({ code: "over_request_rate_limit" })).toBe(true);
    expect(isSupabaseRateLimitError({ status: 429 })).toBe(true);
  });
});

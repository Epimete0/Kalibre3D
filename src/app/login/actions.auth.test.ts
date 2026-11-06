import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, findUnique, upsert, signUp, resetPasswordForEmail } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: vi.fn(), delete: vi.fn() })),
  headers: vi.fn(async () => ({ get: vi.fn(() => "https://kurova.test") })),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth", () => ({ CENTER_COOKIE: "saas3d-center-id", resolveActiveMembership: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { invitationCode: { findFirst }, profile: { findUnique, upsert } } }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { signUp, resetPasswordForEmail } })) }));
vi.mock("@/lib/auth-errors", () => ({
  isExistingSupabaseAccountError: vi.fn((error) => error?.code === "user_already_exists"),
  isSupabaseRateLimitError: vi.fn((error) => error?.code === "over_email_send_rate_limit" || error?.status === 429),
  mapSupabaseAuthError: vi.fn((error) => error?.code === "captcha_failed" ? "Completa la verificación de seguridad e inténtalo nuevamente." : "No fue posible autenticarte. Intenta nuevamente."),
  mapSupabaseLoginError: vi.fn(),
  mapSupabasePasswordError: vi.fn(),
  mapSupabaseSignupError: vi.fn(),
}));
vi.mock("@/lib/action-errors", () => ({ safeActionError: vi.fn(() => "Error genérico.") }));
vi.mock("@/lib/invitation-service", () => ({ redeemInvitation: vi.fn() }));

import { ACCEPT_TERMS_ERROR, TERMS_VERSION } from "@/lib/legal";
import { requestPasswordResetAction, signupAction } from "./actions";

const credentials = () => {
  const data = new FormData();
  data.set("email", "user@example.com");
  data.set("password", "password123");
  data.set("acceptTerms", "on");
  return data;
};
const without = (field: string) => { const data = credentials(); data.delete(field); return data; };

describe("authentication action privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirst.mockResolvedValue(null);
    findUnique.mockResolvedValue(null);
  });

  it("does not disclose or provision an existing signup", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "obfuscated-user", identities: [] }, session: null }, error: null });

    await expect(signupAction({}, credentials())).resolves.toEqual({ message: "Si el correo existe, recibirás un enlace para confirmar la cuenta." });
    expect(findUnique).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("keeps an existing signup error neutral", async () => {
    signUp.mockResolvedValue({ data: { user: null }, error: { code: "user_already_exists" } });

    await expect(signupAction({}, credentials())).resolves.toEqual({ message: "Si el correo existe, recibirás un enlace para confirmar la cuenta." });
    expect(findUnique).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("no crea la cuenta ni envía el correo si no se aceptaron los Términos y la Privacidad", async () => {
    await expect(signupAction({}, without("acceptTerms"))).resolves.toEqual({ error: ACCEPT_TERMS_ERROR });
    for (const value of ["true", "1", "off", ""]) {
      const data = credentials();
      data.set("acceptTerms", value);
      await expect(signupAction({}, data)).resolves.toEqual({ error: ACCEPT_TERMS_ERROR });
    }
    expect(signUp).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("registra con qué versión y cuándo se aceptaron, y sin código lleva a crear el taller", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "new-user", identities: [{}] }, session: null }, error: null });
    const before = Date.now();

    await signupAction({}, credentials());

    expect(signUp).toHaveBeenCalledTimes(1);
    const options = signUp.mock.calls[0][0].options;
    expect(options.data.termsVersion).toBe(TERMS_VERSION);
    expect(new Date(options.data.acceptedTermsAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(options.emailRedirectTo).toContain("/auth/callback?next=/taller/nuevo");
  });

  it("keeps password reset rate limits neutral", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });

    await expect(requestPasswordResetAction({}, credentials())).resolves.toEqual({ message: "Si el correo existe, recibirás un enlace para cambiar tu contraseña." });
  });

  it("returns a safe, actionable error for a password reset CAPTCHA failure", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: "captcha_failed" } });

    await expect(requestPasswordResetAction({}, credentials())).resolves.toEqual({ error: "Completa la verificación de seguridad e inténtalo nuevamente." });
  });
});

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/FormButtons";
import type { AuthFormState } from "@/app/login/actions";

export function AuthForm({
  loginAction,
  signupAction,
  initialMode = "login",
}: {
  initialMode?: "login" | "signup";
  loginAction: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  signupAction: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
}) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action] = useActionState(mode === "login" ? loginAction : signupAction, {});
  const signup = mode === "signup";

  return (
    <div className="min-w-0 max-w-full rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Kalibre</p>
        <h1 className="mt-2 text-3xl text-ink">
          {signup ? "Crea tu acceso" : "Vuelve a tu operación"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {signup
            ? "Crea tu cuenta de usuario. En el paso siguiente podrás registrar tu taller o unirte con invitación."
            : "Ingresa con tu correo y contraseña."}
        </p>
      </div>

      <form action={action} className="space-y-4">
        {state.error ? (
          <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">
            {state.message}
          </p>
        ) : null}

        {signup ? (
          <>
            <Field
              label="Tu nombre"
              htmlFor="displayName"
              hint="Tu nombre y apellido personal. El nombre de tu taller lo configurarás en el siguiente paso."
            >
              <input
                id="displayName"
                name="displayName"
                className={inputClass}
                placeholder="Ej: Matías Silva"
                autoComplete="name"
              />
            </Field>

            <Field
              label="Código de invitación"
              htmlFor="invitationCode"
              hint="Opcional. Solo si un colega te invitó a su taller existente."
            >
              <input
                id="invitationCode"
                name="invitationCode"
                className={inputClass}
                placeholder="Ej: K3D-8821"
              />
            </Field>
          </>
        ) : null}

        <Field label="Correo" htmlFor="email" required>
          <input
            id="email"
            name="email"
            type="email"
            className={inputClass}
            placeholder="nombre@ejemplo.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field label="Contraseña" htmlFor="password" required>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              className={`${inputClass} pr-11`}
              placeholder={signup ? "Mínimo 8 caracteres" : "••••••••"}
              autoComplete={signup ? "new-password" : "current-password"}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              aria-pressed={showPassword}
              title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-r-lg transition-colors"
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" x2="22" y1="2" y2="22" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </Field>

        {signup ? (
          <label className="flex items-start gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
            />
            <span>
              Acepto los{" "}
              <Link
                href="/terminos"
                target="_blank"
                className="font-medium text-primary underline underline-offset-2"
              >
                Términos de uso
              </Link>{" "}
              y la{" "}
              <Link
                href="/privacidad"
                target="_blank"
                className="font-medium text-primary underline underline-offset-2"
              >
                Política de privacidad
              </Link>
              .
            </span>
          </label>
        ) : null}

        <SubmitButton pendingText={signup ? "Creando acceso…" : "Ingresando…"}>
          {signup ? "Crear cuenta" : "Iniciar sesión"}
        </SubmitButton>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line/60 pt-4">
        {!signup ? (
          <Link
            href="/forgot-password"
            className="inline-flex items-center text-xs text-primary hover:text-primary-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setMode(signup ? "login" : "signup")}
          className="inline-flex items-center text-xs text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 font-medium"
        >
          {signup ? "¿Ya tienes una cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate gratis"}
        </button>
      </div>
    </div>
  );
}

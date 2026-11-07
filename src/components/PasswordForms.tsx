"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestPasswordResetAction, updatePasswordAction, type AuthFormState } from "@/app/login/actions";
import { SubmitButton } from "@/components/FormButtons";
import { Field, inputClass } from "@/components/ui";

function Feedback({ state }: { state: AuthFormState }) {
  return (
    <>
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
    </>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, {});
  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8">
      <h1 className="text-3xl text-ink">Recupera tu contraseña</h1>
      <p className="mt-2 text-sm text-muted">
        Te enviaremos un enlace seguro para definir una contraseña nueva.
      </p>
      <form action={action} className="mt-6 space-y-4">
        <Feedback state={state} />
        <Field label="Correo" htmlFor="email" required>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@ejemplo.com"
            className={inputClass}
            required
          />
        </Field>
        <SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton>
      </form>
      <Link href="/login" className="mt-5 inline-block text-sm text-muted hover:text-ink">
        Volver a iniciar sesión
      </Link>
    </div>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePasswordAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8">
      <h1 className="text-3xl text-ink">Nueva contraseña</h1>
      <p className="mt-2 text-sm text-muted">Elige una contraseña de al menos 8 caracteres.</p>
      <form action={action} className="mt-6 space-y-4">
        <Feedback state={state} />
        <Field label="Contraseña nueva" htmlFor="password" required>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              minLength={8}
              autoComplete="new-password"
              className={`${inputClass} pr-11`}
              placeholder="Mínimo 8 caracteres"
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
        <SubmitButton pendingText="Actualizando…">Actualizar contraseña</SubmitButton>
      </form>
      {state.message ? (
        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-primary">
          Iniciar sesión
        </Link>
      ) : null}
    </div>
  );
}

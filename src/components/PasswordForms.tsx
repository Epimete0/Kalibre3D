"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, updatePasswordAction, type AuthFormState } from "@/app/login/actions";
import { SubmitButton } from "@/components/FormButtons";
import { Field, inputClass } from "@/components/ui";

function Feedback({ state }: { state: AuthFormState }) { return <>{state.error ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}{state.message ? <p className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">{state.message}</p> : null}</>; }

export function ForgotPasswordForm() { const [state, action] = useActionState(requestPasswordResetAction, {}); return <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8"><h1 className="text-3xl text-ink">Recupera tu contraseña</h1><p className="mt-2 text-sm text-muted">Te enviaremos un enlace seguro para definir una contraseña nueva.</p><form action={action} className="mt-6 space-y-4"><Feedback state={state} /><Field label="Correo" htmlFor="email" required><input id="email" name="email" type="email" autoComplete="email" className={inputClass} required /></Field><SubmitButton pendingText="Enviando…">Enviar enlace</SubmitButton></form><Link href="/login" className="mt-5 inline-block text-sm text-muted hover:text-ink">Volver a iniciar sesión</Link></div>; }

export function ResetPasswordForm() { const [state, action] = useActionState(updatePasswordAction, {}); return <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-6 shadow-[0_18px_45px_rgba(35,31,26,0.1)] sm:p-8"><h1 className="text-3xl text-ink">Nueva contraseña</h1><p className="mt-2 text-sm text-muted">Elige una contraseña de al menos 8 caracteres.</p><form action={action} className="mt-6 space-y-4"><Feedback state={state} /><Field label="Contraseña nueva" htmlFor="password" required><input id="password" name="password" type="password" minLength={8} autoComplete="new-password" className={inputClass} required /></Field><SubmitButton pendingText="Actualizando…">Actualizar contraseña</SubmitButton></form>{state.message ? <Link href="/login" className="mt-5 inline-block text-sm font-medium text-primary">Iniciar sesión</Link> : null}</div>; }

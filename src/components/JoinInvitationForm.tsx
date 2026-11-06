"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { redeemInvitationAction } from "@/app/join/actions";
import { SubmitButton } from "@/components/FormButtons";
import { Field, inputClass } from "@/components/ui";

export function JoinInvitationForm() { const [state, action] = useActionState(redeemInvitationAction, {}); const router = useRouter(); useEffect(() => { if (state.message) { const timer = window.setTimeout(() => { router.replace("/dashboard"); }, 700); return () => window.clearTimeout(timer); } }, [state.message, router]); return <form action={action} className="mt-6 space-y-4">{state.error ? <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}{state.message ? <p className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">{state.message}</p> : null}<Field label="Código de invitación" htmlFor="code" required><input id="code" name="code" className={inputClass} autoComplete="off" spellCheck={false} placeholder="Ej: A1B2-C3D4-E5F6" required /></Field><SubmitButton pendingText="Uniéndote…">Unirme al taller</SubmitButton></form>; }

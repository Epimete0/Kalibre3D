"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Dialog, useCloseDialog } from "@/components/Dialog";
import { Field, inputClass } from "@/components/ui";
import { ROLE_LABEL, type TeamRole } from "@/lib/team-rules";
import { changeRoleAction, createInvitationAction, revokeInvitationAction, setMemberActiveAction, type TeamActionState } from "./actions";

const primary = "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:opacity-60";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const danger = "inline-flex min-h-11 items-center justify-center rounded-full border border-danger/30 bg-raised px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 disabled:opacity-60";

type ServerAction = (state: TeamActionState, data: FormData) => Promise<TeamActionState>;

function Message({ state }: { state: TeamActionState }) {
  if (state.error) return <p role="alert" data-testid="team-error" className="w-full rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state.message && !state.code) return <p role="status" data-testid="team-message" className="w-full rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">{state.message}</p>;
  return null;
}

function ActionButton({ action, fields, label, pendingLabel, className, confirmText }: { action: ServerAction; fields: Record<string, string>; label: string; pendingLabel: string; className: string; confirmText?: string }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <>
      <button type="button" disabled={pending} className={className} onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        const data = new FormData();
        for (const [key, value] of Object.entries(fields)) data.set(key, value);
        startTransition(() => run(data));
      }}>{pending ? pendingLabel : label}</button>
      <Message state={state} />
    </>
  );
}

export function ActiveButton({ userId, name, active }: { userId: string; name: string; active: boolean }) {
  return <ActionButton action={setMemberActiveAction} fields={{ userId, active: String(!active) }} label={active ? "Desactivar" : "Reactivar"} pendingLabel="Guardando…" className={active ? danger : secondary} confirmText={active ? `¿Desactivar a ${name}? Dejará de entrar a este taller. No se borra su historial.` : undefined} />;
}

function RoleForm({ userId, options }: { userId: string; options: TeamRole[] }) {
  const [state, run, pending] = useActionState(changeRoleAction, {});
  const closeDialog = useCloseDialog();
  const [role, setRole] = useState(options[0] ?? "");
  useEffect(() => { if (state.message) closeDialog(); }, [state.message, closeDialog]);
  return (
    <form className="grid min-w-0 grid-cols-1 gap-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("userId", userId); data.set("role", role); startTransition(() => run(data)); }}>
      <Field label="Nuevo rol" htmlFor={`role-${userId}`}>
        <select id={`role-${userId}`} value={role} onChange={(event) => setRole(event.target.value as TeamRole)} className={inputClass}>
          {options.map((option) => <option key={option} value={option}>{ROLE_LABEL[option]}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted">El cambio vale desde la próxima vez que la persona abra una pantalla.</p>
      {state.error ? <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <div className="flex justify-end"><button type="submit" disabled={pending || !role} className={primary}>{pending ? "Guardando…" : "Guardar rol"}</button></div>
    </form>
  );
}

export function ChangeRoleDialog({ userId, name, options }: { userId: string; name: string; options: TeamRole[] }) {
  return (
    <Dialog triggerLabel="Cambiar rol" triggerClassName={secondary} title="Cambiar rol" description={`Qué puede hacer ${name} en el taller.`}>
      <RoleForm userId={userId} options={options} />
    </Dialog>
  );
}

function InviteForm({ roles }: { roles: TeamRole[] }) {
  const [state, run, pending] = useActionState(createInvitationAction, {});
  const [role, setRole] = useState(roles[roles.length - 2] ?? roles[0] ?? "");
  const [copied, setCopied] = useState(false);
  if (state.code) {
    return (
      <div className="grid min-w-0 gap-3">
        <p className="text-sm text-ink">Comparte este código con la persona. <strong className="font-semibold">Solo se muestra ahora</strong>: si lo pierdes, crea otro.</p>
        <p data-testid="invitation-code" className="rounded-lg border border-line bg-canvas px-4 py-3 text-center font-mono text-xl tracking-widest text-ink [overflow-wrap:anywhere]">{state.code}</p>
        <p className="text-xs text-muted">Se usa una sola vez y vence el {state.expiresAt ? new Date(state.expiresAt).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "en 7 días"}.</p>
        <div className="flex justify-end"><button type="button" className={secondary} onClick={() => { void navigator.clipboard?.writeText(state.code ?? "").then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? "Copiado" : "Copiar código"}</button></div>
      </div>
    );
  }
  return (
    <form className="grid min-w-0 grid-cols-1 gap-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("role", role); startTransition(() => run(data)); }}>
      <Field label="Rol de la persona" htmlFor="invite-role" hint="Lo que podrá hacer al unirse. Puedes cambiarlo después.">
        <select id="invite-role" value={role} onChange={(event) => setRole(event.target.value as TeamRole)} className={inputClass}>
          {roles.map((option) => <option key={option} value={option}>{ROLE_LABEL[option]}</option>)}
        </select>
      </Field>
      {state.error ? <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <div className="flex justify-end"><button type="submit" disabled={pending || !role} className={primary}>{pending ? "Creando…" : "Crear código"}</button></div>
    </form>
  );
}

export function InviteDialog({ roles }: { roles: TeamRole[] }) {
  return (
    <Dialog triggerLabel="+ Invitar a alguien" triggerClassName={primary} title="Invitar al equipo" description="El código es de un solo uso y vence a los 7 días.">
      <InviteForm roles={roles} />
    </Dialog>
  );
}

export function RevokeButton({ id }: { id: string }) {
  return <ActionButton action={revokeInvitationAction} fields={{ id }} label="Revocar" pendingLabel="Revocando…" className={secondary} confirmText="¿Revocar esta invitación? El código dejará de funcionar." />;
}

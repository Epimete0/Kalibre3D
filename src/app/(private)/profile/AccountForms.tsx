"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { changeEmailAction, changePasswordAction, saveCenterAction, saveDisplayNameAction, switchCenterAction } from "./actions";

const primary = "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:opacity-60";
const secondary = "inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-raised px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";

type State = { error?: string; message?: string };

function Feedback({ state, testId }: { state: State; testId: string }) {
  if (state.error) return <p role="alert" data-testid={`${testId}-error`} className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p>;
  if (state.message) return <p role="status" data-testid={`${testId}-message`} className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">{state.message}</p>;
  return null;
}

/** Nombre que ven las demás personas en el equipo, los pedidos y la actividad. */
export function DisplayNameForm({ initial }: { initial: string }) {
  const [state, run, pending] = useActionState(saveDisplayNameAction, {});
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); if (state.message) setSaved(value.trim()); }
  const changed = value.trim() !== saved.trim();
  return (
    <form className="grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("displayName", value); startTransition(() => run(data)); }}>
      <Field label="Tu nombre" htmlFor="account-name" hint="Es el que ven las demás personas del taller.">
        <input id="account-name" value={value} onChange={(event) => setValue(event.target.value)} maxLength={80} autoComplete="name" className={inputClass} />
      </Field>
      <Feedback state={state} testId="name" />
      <div className="flex justify-end"><button type="submit" disabled={pending || !changed} className={primary}>{pending ? "Guardando…" : "Guardar nombre"}</button></div>
    </form>
  );
}

/** Cambio del correo de acceso: se confirma desde el correo nuevo. */
export function EmailForm({ currentEmail, pendingEmail }: { currentEmail: string; pendingEmail: string | null }) {
  const [state, run, pending] = useActionState(changeEmailAction, {});
  const [value, setValue] = useState("");
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); if (state.message) setValue(""); }
  const same = value.trim().toLowerCase() === currentEmail.toLowerCase();
  return (
    <form className="grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("email", value); startTransition(() => run(data)); }}>
      {pendingEmail ? <p role="status" data-testid="email-pending" className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm text-ink">Cambio pendiente a <strong className="[overflow-wrap:anywhere]">{pendingEmail}</strong>. Revisa ese correo para confirmarlo; mientras tanto sigues entrando con el actual.</p> : null}
      <Field label="Correo nuevo" htmlFor="account-new-email" hint="Te enviaremos un correo para confirmarlo. Tu correo de acceso no cambia hasta entonces.">
        <input id="account-new-email" type="email" value={value} onChange={(event) => setValue(event.target.value)} maxLength={254} autoComplete="email" inputMode="email" className={inputClass} />
      </Field>
      {same ? <p role="alert" className="text-xs text-danger">Ese ya es tu correo de acceso.</p> : null}
      <Feedback state={state} testId="email" />
      <div className="flex justify-end"><button type="submit" disabled={pending || !value.trim() || same} className={primary}>{pending ? "Enviando…" : "Pedir cambio de correo"}</button></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, run, pending] = useActionState(changePasswordAction, {});
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); if (state.message) { setPassword(""); setConfirm(""); } }
  const problem = password && password.length < 8 ? "Usa al menos 8 caracteres." : confirm && confirm !== password ? "Las contraseñas no coinciden." : null;
  return (
    <form className="grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("password", password); data.set("confirm", confirm); startTransition(() => run(data)); }}>
      <Field label="Nueva contraseña" htmlFor="account-password" hint="Mínimo 8 caracteres.">
        <input id="account-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Repite la contraseña" htmlFor="account-confirm">
        <input id="account-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className={inputClass} />
      </Field>
      {problem ? <p role="alert" className="text-xs text-danger">{problem}</p> : null}
      <Feedback state={state} testId="password" />
      <div className="flex justify-end"><button type="submit" disabled={pending || !password || Boolean(problem)} className={primary}>{pending ? "Guardando…" : "Cambiar contraseña"}</button></div>
    </form>
  );
}

/** Nombre y zona horaria del taller. */
export function CenterForm({ name, timeZone, nameLockedUntil }: { name: string; timeZone: string; nameLockedUntil: string | null }) {
  const [state, run, pending] = useActionState(saveCenterAction, {});
  const [centerName, setCenterName] = useState(name);
  const [zone, setZone] = useState(timeZone);
  const zones = useMemo(() => { try { return Intl.supportedValuesOf("timeZone"); } catch { return [] as string[]; } }, []);
  const changed = (!nameLockedUntil && centerName.trim() !== name) || zone !== timeZone;
  return (
    <form className="grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("name", nameLockedUntil ? name : centerName); data.set("timeZone", zone); startTransition(() => run(data)); }}>
      <Field label="Nombre del taller" htmlFor="center-name" hint={nameLockedUntil ? `El nombre ya se cambió hace poco. Podrás cambiarlo de nuevo desde el ${nameLockedUntil}.` : undefined}>
        <input id="center-name" data-testid="center-name-input" value={centerName} onChange={(event) => setCenterName(event.target.value)} maxLength={100} autoComplete="organization" disabled={Boolean(nameLockedUntil)} aria-describedby={nameLockedUntil ? "center-name-locked" : undefined} className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-70`} />
        {nameLockedUntil ? <span id="center-name-locked" data-testid="center-name-locked" className="sr-only">Cambio de nombre disponible desde el {nameLockedUntil}.</span> : null}
      </Field>
      <Field label="Zona horaria" htmlFor="center-zone" hint="Define el día y la hora con que se registran tus pedidos y movimientos.">
        <input id="center-zone" list="center-zones" value={zone} onChange={(event) => setZone(event.target.value)} autoComplete="off" className={inputClass} />
        <datalist id="center-zones">{zones.map((entry) => <option key={entry} value={entry} />)}</datalist>
      </Field>
      <Feedback state={state} testId="center" />
      <div className="flex justify-end"><button type="submit" disabled={pending || !changed} className={primary}>{pending ? "Guardando…" : "Guardar taller"}</button></div>
    </form>
  );
}

/** Para quien pertenece a más de un taller. */
export function SwitchCenterForm({ centers, current }: { centers: { id: string; name: string }[]; current: string }) {
  const [state, run, pending] = useActionState(switchCenterAction, {});
  const [value, setValue] = useState(current);
  return (
    <form className="grid min-w-0 grid-cols-1 gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(); data.set("centerId", value); startTransition(() => run(data)); }}>
      <Field label="Taller activo" htmlFor="center-switch" hint="Perteneces a más de un taller. Al cambiar, vuelves al inicio de ese taller.">
        <select id="center-switch" value={value} onChange={(event) => setValue(event.target.value)} className={inputClass}>
          {centers.map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
        </select>
      </Field>
      <Feedback state={state} testId="switch" />
      <div className="flex justify-end"><button type="submit" disabled={pending || value === current} className={secondary}>{pending ? "Cambiando…" : "Cambiar de taller"}</button></div>
    </form>
  );
}

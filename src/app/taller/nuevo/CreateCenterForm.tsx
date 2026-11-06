"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/FormButtons";
import { Field, inputClass } from "@/components/ui";
import { CENTER_NAME_MAX, CENTER_TIME_ZONES, DEFAULT_CENTER_TIME_ZONE } from "@/lib/center-creation-rules";
import { createCenterAction } from "./actions";

/** `centerId` lo genera la página: repetir el envío (doble clic, dos pestañas) nunca crea dos talleres. */
export function CreateCenterForm({ centerId }: { centerId: string }) {
  const [state, action] = useActionState(createCenterAction, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="centerId" value={centerId} />
      {state.error ? <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <Field label="Nombre del taller" htmlFor="center-name" required hint="Es el nombre que verá tu equipo. Puedes cambiarlo después.">
        <input id="center-name" name="name" className={inputClass} autoComplete="organization" maxLength={CENTER_NAME_MAX} placeholder="Ej: Estética Aurora" required autoFocus />
      </Field>
      <Field label="Zona horaria" htmlFor="center-timezone" required hint="Define el día y la hora con que se registran tus pedidos y movimientos.">
        <select id="center-timezone" name="timeZone" className={inputClass} defaultValue={DEFAULT_CENTER_TIME_ZONE} required>
          {CENTER_TIME_ZONES.map((zone) => <option key={zone.value} value={zone.value}>{zone.label}</option>)}
        </select>
      </Field>
      <p className="text-xs text-muted">Serás el dueño del taller, con todos los permisos. Podrás invitar a tu equipo después.</p>
      <SubmitButton pendingText="Creando tu taller…">Crear mi taller</SubmitButton>
    </form>
  );
}

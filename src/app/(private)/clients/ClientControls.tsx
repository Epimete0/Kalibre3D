"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useActionState, useId, useState } from "react";
import { Badge, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import type { CustomerListItem } from "@/lib/customer-queries";
import { createCustomerAction, deleteCustomerAction, setCustomerActiveAction } from "./actions";

const primaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const secondaryBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";

type State = { error?: string; message?: string; customerId?: string };

function Feedback({ state }: { state: State }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-xs text-ok">
        {state.message}
      </p>
    );
  return null;
}

export function CreateCustomerBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, run, pending] = useActionState(createCustomerAction, {});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [instagram, setInstagram] = useState("");
  const [notes, setNotes] = useState("");
  const [seen, setSeen] = useState(state);

  const nameId = useId();
  const phoneId = useId();
  const instagramId = useId();
  const notesId = useId();

  if (state !== seen) {
    setSeen(state);
    if (state.message) {
      setName("");
      setPhone("");
      setInstagram("");
      setNotes("");
      setIsOpen(false);
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData();
    data.set("name", name);
    data.set("phone", phone);
    data.set("instagram", instagram);
    data.set("notes", notes);
    startTransition(() => run(data));
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Nuevo cliente</h2>
          <p className="text-xs text-muted">Registra a un cliente para asignarle ventas y dar seguimiento.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={secondaryBtn}
          aria-expanded={isOpen}
        >
          {isOpen ? "Cerrar formulario" : "+ Agregar cliente"}
        </button>
      </div>

      <div className="mt-3">
        <Feedback state={state} />
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-line/60 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <Field label="Nombre completo" htmlFor={nameId} required>
                <input
                  id={nameId}
                  type="text"
                  required
                  placeholder="Ej: Rodrigo Valenzuela"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  disabled={pending}
                />
              </Field>
            </div>
            <div>
              <Field label="Teléfono / WhatsApp" htmlFor={phoneId} hint="Con código de país (ej. +569...)">
                <input
                  id={phoneId}
                  type="tel"
                  placeholder="+56912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  disabled={pending}
                />
              </Field>
            </div>
            <div>
              <Field label="Instagram" htmlFor={instagramId} hint="Usuario (con o sin @)">
                <input
                  id={instagramId}
                  type="text"
                  placeholder="ej. surko.3d"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  className={inputClass}
                  disabled={pending}
                />
              </Field>
            </div>
          </div>

          <div>
            <Field label="Notas internas" htmlFor={notesId} hint="Dirección, preferencias o comentarios del cliente.">
              <textarea
                id={notesId}
                rows={2}
                placeholder="Notas opcionales..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={inputClass}
                disabled={pending}
              />
            </Field>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className={secondaryBtn}
              disabled={pending}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? "Guardando…" : "Guardar cliente"}
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function CustomerSearchAndFilters({
  currentSearch,
  includeInactive,
}: {
  currentSearch: string;
  includeInactive: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentSearch);

  const applyParams = (newQuery: string, newAll: boolean) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (newQuery.trim()) {
      params.set("q", newQuery.trim());
    } else {
      params.delete("q");
    }
    if (newAll) {
      params.set("all", "true");
    } else {
      params.delete("all");
    }
    router.replace(`/clients?${params.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyParams(query, includeInactive);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form onSubmit={handleSubmit} className="relative flex-1 sm:max-w-md">
        <input
          type="search"
          placeholder="Buscar por nombre, teléfono o Instagram..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
        />
      </form>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => applyParams(query, false)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            !includeInactive ? "bg-primary text-white" : "border border-line bg-raised text-muted hover:text-ink"
          }`}
        >
          Solo activos
        </button>
        <button
          type="button"
          onClick={() => applyParams(query, true)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            includeInactive ? "bg-primary text-white" : "border border-line bg-raised text-muted hover:text-ink"
          }`}
        >
          Todos
        </button>
      </div>
    </div>
  );
}

function cleanPhoneForWa(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function CustomerRowActions({
  customer,
  canManage,
  canDelete,
}: {
  customer: CustomerListItem;
  canManage: boolean;
  canDelete: boolean;
}) {
  const [toggleState, runToggle, togglePending] = useActionState(setCustomerActiveAction, {});
  const [deleteState, runDelete, deletePending] = useActionState(deleteCustomerAction, {});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = () => {
    const data = new FormData();
    data.set("id", customer.id);
    data.set("active", (!customer.active).toString());
    startTransition(() => runToggle(data));
  };

  const handleDelete = () => {
    const data = new FormData();
    data.set("id", customer.id);
    startTransition(() => runDelete(data));
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Link
          href={`/clients/${customer.id}`}
          className="inline-flex min-h-8 items-center justify-center rounded border border-line bg-raised px-2.5 text-xs font-semibold text-ink hover:bg-canvas"
        >
          Ver detalle
        </Link>
        {canManage && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={togglePending}
            className="inline-flex min-h-8 items-center justify-center rounded border border-line bg-raised px-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
            title={customer.active ? "Desactivar cliente" : "Activar cliente"}
          >
            {togglePending ? "…" : customer.active ? "Desactivar" : "Activar"}
          </button>
        )}
        {canDelete && customer.ordersCount === 0 && (
          <>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deletePending}
                  className="rounded bg-danger px-2 py-1 text-xs font-semibold text-white hover:bg-danger-hover disabled:opacity-50"
                >
                  {deletePending ? "…" : "Sí, borrar"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletePending}
                  className="rounded border border-line px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex min-h-8 items-center justify-center rounded border border-danger/30 bg-danger-soft px-2 text-xs font-medium text-danger hover:bg-danger/20"
                title="Eliminar cliente sin ventas"
              >
                Borrar
              </button>
            )}
          </>
        )}
      </div>
      <Feedback state={toggleState} />
      <Feedback state={deleteState} />
    </div>
  );
}

export function CustomerListTable({
  customers,
  currency,
  canManage,
  canDelete,
}: {
  customers: CustomerListItem[];
  currency: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  if (customers.length === 0) {
    return (
      <EmptyState
        title="Aquí verás a tus clientes"
        description="Guarda a quienes te compran seguido para ver su historial y cuánto te deben. Es opcional: puedes vender sin cliente. Si buscaste un nombre, prueba con otro o toca «Todos»."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Vista de escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line/80 bg-canvas/60 text-xs font-semibold text-muted">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Pedidos</th>
              <th className="px-4 py-3 text-right">Saldo pendiente</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {customers.map((c) => {
              const waClean = c.phone ? cleanPhoneForWa(c.phone) : null;
              return (
                <tr key={c.id} className="transition-colors hover:bg-canvas/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-semibold text-ink hover:text-primary transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.notes && <p className="text-xs text-muted truncate max-w-xs">{c.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-col gap-1">
                      {c.phone && (
                        <a
                          href={`https://wa.me/${waClean}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted hover:text-ok transition-colors"
                          title="Contactar por WhatsApp"
                        >
                          <span className="font-mono">{c.phone}</span>
                        </a>
                      )}
                      {c.instagram && (
                        <a
                          href={`https://instagram.com/${c.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted hover:text-primary transition-colors"
                          title="Ver perfil de Instagram"
                        >
                          @{c.instagram}
                        </a>
                      )}
                      {!c.phone && !c.instagram && <span className="text-faint">Sin contacto</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge tone={c.active ? "ok" : "neutral"}>
                      {c.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {c.ordersCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.pendingBalance === null ? (
                      <span className="text-muted">—</span>
                    ) : c.pendingBalance > 0 ? (
                      <span className="font-semibold text-warn">
                        {formatMoney(c.pendingBalance, currency)}
                      </span>
                    ) : (
                      <span className="text-xs text-ok font-medium">Al día</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CustomerRowActions
                      customer={c}
                      canManage={canManage}
                      canDelete={canDelete}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Vista móvil (tarjetas) */}
      <div className="divide-y divide-line/60 md:hidden">
        {customers.map((c) => {
          const waClean = c.phone ? cleanPhoneForWa(c.phone) : null;
          return (
            <div key={c.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/clients/${c.id}`}
                    className="font-semibold text-ink hover:text-primary transition-colors"
                  >
                    {c.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge tone={c.active ? "ok" : "neutral"}>
                      {c.active ? "Activo" : "Inactivo"}
                    </Badge>
                    <span className="text-xs text-muted">{c.ordersCount} pedidos</span>
                  </div>
                </div>
                <div className="text-right">
                  {c.pendingBalance === null ? null : c.pendingBalance > 0 ? (
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-muted block">Saldo</span>
                      <span className="font-semibold text-warn text-sm">
                        {formatMoney(c.pendingBalance, currency)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-ok font-medium">Al día</span>
                  )}
                </div>
              </div>

              {(c.phone || c.instagram || c.notes) && (
                <div className="rounded-lg bg-canvas/50 p-2.5 text-xs text-muted space-y-1">
                  {c.phone && (
                    <div>
                      <span className="font-medium text-ink">Teléfono: </span>
                      <a
                        href={`https://wa.me/${waClean}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {c.phone}
                      </a>
                    </div>
                  )}
                  {c.instagram && (
                    <div>
                      <span className="font-medium text-ink">Instagram: </span>
                      <a
                        href={`https://instagram.com/${c.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        @{c.instagram}
                      </a>
                    </div>
                  )}
                  {c.notes && <p className="italic text-ink/80">{c.notes}</p>}
                </div>
              )}

              <div className="pt-1 flex justify-end">
                <CustomerRowActions
                  customer={c}
                  canManage={canManage}
                  canDelete={canDelete}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useId, useState } from "react";
import { Badge, Card, EmptyState, Field, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import { CHANNEL_LABEL, STATUS_LABEL, orderNumberLabel } from "@/lib/order-presentation";
import type { OrderChannel, OrderStatus } from "@/lib/order-status";
import type { CustomerDetail } from "@/lib/customer-queries";
import { deleteCustomerAction, setCustomerActiveAction, updateCustomerAction } from "../actions";

const primaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const secondaryBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const dangerBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft px-3 text-xs font-semibold text-danger transition-colors hover:bg-danger/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 disabled:opacity-60";

type State = { error?: string; message?: string };

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

function cleanPhoneForWa(phone: string): string {
  return phone.replace(/\D/g, "");
}

function statusTone(status: string): "neutral" | "ok" | "warn" | "danger" | "accent" {
  switch (status) {
    case "DELIVERED":
      return "ok";
    case "READY":
    case "PRINTING":
      return "warn";
    case "CONFIRMED":
      return "accent";
    case "CANCELED":
    case "RETURNED":
      return "danger";
    default:
      return "neutral";
  }
}

export function EditCustomerModal({
  customer,
  isOpen,
  onClose,
}: {
  customer: CustomerDetail;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [state, run, pending] = useActionState(updateCustomerAction, {});
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [instagram, setInstagram] = useState(customer.instagram ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [seen, setSeen] = useState(state);

  const nameId = useId();
  const phoneId = useId();
  const instagramId = useId();
  const notesId = useId();

  if (state !== seen) {
    setSeen(state);
    if (state.message) {
      onClose();
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData();
    data.set("id", customer.id);
    data.set("name", name);
    data.set("phone", phone);
    data.set("instagram", instagram);
    data.set("notes", notes);
    startTransition(() => run(data));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-lg p-5 sm:p-6 bg-surface shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h3 className="text-lg font-semibold text-ink">Editar cliente</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        <div className="mt-3">
          <Feedback state={state} />
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <Field label="Nombre completo" htmlFor={nameId} required>
            <input
              id={nameId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              disabled={pending}
            />
          </Field>

          <Field label="Teléfono / WhatsApp" htmlFor={phoneId} hint="Con código de país (ej. +569...)">
            <input
              id={phoneId}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              disabled={pending}
            />
          </Field>

          <Field label="Instagram" htmlFor={instagramId} hint="Usuario (sin @)">
            <input
              id={instagramId}
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className={inputClass}
              disabled={pending}
            />
          </Field>

          <Field label="Notas internas" htmlFor={notesId}>
            <textarea
              id={notesId}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              disabled={pending}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-line/60">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={secondaryBtn}
            >
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={primaryBtn}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function CustomerDetailHeader({
  customer,
  currency,
  canManage,
  canDelete,
}: {
  customer: CustomerDetail;
  currency: string;
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
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
    startTransition(async () => {
      await runDelete(data);
      router.push("/clients");
    });
  };

  const waClean = customer.phone ? cleanPhoneForWa(customer.phone) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/clients"
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              ← Volver a clientes
            </Link>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {customer.name}
            </h1>
            <Badge tone={customer.active ? "ok" : "neutral"}>
              {customer.active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {customer.phone && (
              <a
                href={`https://wa.me/${waClean}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-ok/30 bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok hover:bg-ok/20 transition-colors"
              >
                <span>WhatsApp: {customer.phone}</span>
              </a>
            )}
            {customer.instagram && (
              <a
                href={`https://instagram.com/${customer.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-raised px-2.5 py-1 text-xs font-semibold text-primary hover:bg-canvas transition-colors"
              >
                <span>@{customer.instagram}</span>
              </a>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className={secondaryBtn}
            >
              Editar datos
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={togglePending}
              className={secondaryBtn}
            >
              {togglePending ? "…" : customer.active ? "Desactivar" : "Activar"}
            </button>
            {canDelete && customer.orders.length === 0 && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deletePending}
                      className="rounded bg-danger px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-danger-hover disabled:opacity-50"
                    >
                      {deletePending ? "…" : "Confirmar borrado"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deletePending}
                      className="rounded border border-line px-2 py-1.5 text-xs text-muted hover:text-ink"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className={dangerBtn}
                  >
                    Eliminar cliente
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <Feedback state={toggleState} />
      <Feedback state={deleteState} />

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Pedidos</span>
          <p className="mt-1 text-2xl font-bold text-ink">{customer.orders.length}</p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Total comprado</span>
          <p className="mt-1 text-2xl font-bold text-ink">
            {customer.totalSpent === null ? "—" : formatMoney(customer.totalSpent, currency)}
          </p>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Saldo pendiente</span>
          <p
            className={`mt-1 text-2xl font-bold ${
              customer.pendingBalance !== null && customer.pendingBalance > 0
                ? "text-warn"
                : "text-ink"
            }`}
          >
            {customer.pendingBalance === null
              ? "—"
              : customer.pendingBalance > 0
              ? formatMoney(customer.pendingBalance, currency)
              : "Al día"}
          </p>
        </Card>
      </div>

      {customer.notes && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Notas del cliente</h3>
          <p className="mt-1 text-sm text-ink whitespace-pre-wrap">{customer.notes}</p>
        </Card>
      )}

      {/* Modal de edición */}
      <EditCustomerModal
        customer={customer}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </div>
  );
}

export function CustomerOrdersTable({
  customer,
  currency,
}: {
  customer: CustomerDetail;
  currency: string;
}) {
  if (customer.orders.length === 0) {
    return (
      <EmptyState
        title="Sin pedidos registrados"
        description="Este cliente aún no tiene ventas o pedidos asociados."
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-line/80 bg-canvas/40">
        <h2 className="text-base font-semibold text-ink">Historial de pedidos ({customer.orders.length})</h2>
      </div>

      {/* Vista de escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line/80 bg-canvas/60 text-xs font-semibold text-muted">
            <tr>
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Canal</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Piezas</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Pagado</th>
              <th className="px-4 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {customer.orders.map((o) => {
              const status = o.status as OrderStatus;
              const channel = o.channel as OrderChannel;
              const tone = statusTone(o.status);

              return (
                <tr key={o.id} className="transition-colors hover:bg-canvas/30">
                  <td className="px-4 py-3 font-semibold text-ink">
                    {orderNumberLabel(o.number)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {CHANNEL_LABEL[channel] ?? o.channel}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={tone}>
                      {STATUS_LABEL[status] ?? o.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {o.itemsCount} {o.itemsCount === 1 ? "pieza" : "piezas"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {o.total === null ? "—" : formatMoney(o.total, currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {o.paid === null ? "—" : formatMoney(o.paid, currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.balance === null ? (
                      "—"
                    ) : o.balance > 0 ? (
                      <span className="font-semibold text-warn">{formatMoney(o.balance, currency)}</span>
                    ) : (
                      <span className="text-xs text-ok font-medium">Pagado</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Vista móvil */}
      <div className="divide-y divide-line/60 md:hidden">
        {customer.orders.map((o) => {
          const status = o.status as OrderStatus;
          const channel = o.channel as OrderChannel;
          const tone = statusTone(o.status);

          return (
            <div key={o.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink text-sm">
                  {orderNumberLabel(o.number)}
                </span>
                <Badge tone={tone}>
                  {STATUS_LABEL[status] ?? o.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted">
                <span>Canal: {CHANNEL_LABEL[channel] ?? o.channel}</span>
                <span>{o.itemsCount} {o.itemsCount === 1 ? "pieza" : "piezas"}</span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-line/40 text-xs">
                <span>Total: {o.total === null ? "—" : formatMoney(o.total, currency)}</span>
                <span>
                  {o.balance === null ? (
                    "—"
                  ) : o.balance > 0 ? (
                    <span className="font-semibold text-warn">Saldo: {formatMoney(o.balance, currency)}</span>
                  ) : (
                    <span className="text-ok font-medium">Pagado</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

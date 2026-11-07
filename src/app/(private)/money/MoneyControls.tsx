"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, Card, EmptyState, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import {
  CATEGORY_LABEL,
  MANUAL_EXPENSE_CATEGORIES,
  MANUAL_INCOME_CATEGORIES,
  METHOD_LABEL,
  PAYMENT_METHODS,
  type MoneyCategory,
  type PaymentMethod,
} from "@/lib/money-presentation";
import type { MonthlyMoneyView } from "@/lib/money-queries";
import { CHANNEL_LABEL, orderNumberLabel } from "@/lib/order-presentation";
import type { OrderChannel } from "@/lib/order-status";
import { recordManualMoneyAction, voidMoneyAction } from "./actions";

function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const idx = Number.parseInt(m ?? "1", 10) - 1;
  const monthName = MONTH_NAMES[idx] ?? monthStr;
  return `${monthName} ${y}`;
}

export function MoneyControls({
  view,
  currency,
  initialMode = null,
}: {
  view: MonthlyMoneyView;
  currency: string;
  initialMode?: "EXPENSE" | "INCOME" | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formMode, setFormMode] = useState<"EXPENSE" | "INCOME" | null>(initialMode);
  const [operationId, setOperationId] = useState<string>(() => makeUuid());
  const [category, setCategory] = useState<string>(
    initialMode === "INCOME" ? "DIGITAL_SALE" : "FILAMENT"
  );
  const [amountStr, setAmountStr] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const [occurredOn, setOccurredOn] = useState(view.todayStr);
  const [notes, setNotes] = useState("");

  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function openForm(mode: "EXPENSE" | "INCOME") {
    setError(null);
    setMessage(null);
    setFormMode(mode);
    setCategory(mode === "EXPENSE" ? "FILAMENT" : "DIGITAL_SALE");
    setAmountStr("");
    setNotes("");
    setOccurredOn(view.todayStr);
  }

  function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!formMode) return;
    setError(null);
    setMessage(null);

    const amount = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }

    startTransition(async () => {
      const res = await recordManualMoneyAction({
        operationId,
        type: formMode,
        category,
        amount,
        method,
        occurredOn,
        notes: notes.trim() || null,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Movimiento registrado correctamente.");
        setOperationId(makeUuid());
        setAmountStr("");
        setNotes("");
        setFormMode(null);
        router.refresh();
      }
    });
  }

  function handleVoid(txId: string) {
    setError(null);
    setMessage(null);
    if (!voidReason.trim()) {
      setError("Debes indicar el motivo de la anulación.");
      return;
    }

    startTransition(async () => {
      const res = await voidMoneyAction({
        transactionId: txId,
        reason: voidReason.trim(),
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Movimiento anulado correctamente.");
        setVoidingId(null);
        setVoidReason("");
        router.refresh();
      }
    });
  }

  const incomeChannels = Object.entries(view.summary.incomeByChannel).sort(
    (a, b) => b[1] - a[1]
  );
  const expenseCategories = Object.entries(view.summary.expenseByCategory).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="space-y-5">
      {/* Barra superior: Selector de mes y botones de alta rápida (390px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center justify-between sm:justify-start gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-sm">
          <Link
            href={`/money?month=${view.previousMonth}`}
            aria-label="Mes anterior"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-line/60 bg-raised px-3 text-sm font-bold text-ink hover:bg-canvas transition-colors touch-manipulation"
          >
            ←
          </Link>
          <span className="px-3 text-sm sm:text-base font-bold text-ink">
            {formatMonthLabel(view.month)}
          </span>
          <Link
            href={`/money?month=${view.nextMonth}`}
            aria-label="Mes siguiente"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-line/60 bg-raised px-3 text-sm font-bold text-ink hover:bg-canvas transition-colors touch-manipulation"
          >
            →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => openForm("EXPENSE")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-primary-hover transition-colors touch-manipulation"
          >
            + Registrar gasto
          </button>
          <button
            type="button"
            onClick={() => openForm("INCOME")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-canvas transition-colors touch-manipulation"
          >
            + Otro ingreso
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs sm:text-sm font-medium text-danger"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-xs sm:text-sm font-medium text-ok"
        >
          {message}
        </div>
      )}

      {/* Formulario táctil de alta rápida de gasto o ingreso suelto */}
      {formMode && (
        <Card className="p-4 sm:p-5 border-primary/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              {formMode === "EXPENSE"
                ? "Registrar gasto del taller"
                : "Registrar ingreso suelto (ej. venta de archivo)"}
            </h2>
            <div className="inline-flex rounded-lg border border-line bg-raised p-0.5 text-xs">
              <button
                type="button"
                onClick={() => openForm("EXPENSE")}
                className={`rounded-md px-2.5 py-1 font-semibold ${
                  formMode === "EXPENSE" ? "bg-primary text-white" : "text-muted"
                }`}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => openForm("INCOME")}
                className={`rounded-md px-2.5 py-1 font-semibold ${
                  formMode === "INCOME" ? "bg-primary text-white" : "text-muted"
                }`}
              >
                Ingreso
              </button>
            </div>
          </div>

          <form onSubmit={handleRecord} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">
                Categoría *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(formMode === "EXPENSE"
                  ? MANUAL_EXPENSE_CATEGORIES
                  : MANUAL_INCOME_CATEGORIES
                ).map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors touch-manipulation ${
                        active
                          ? "bg-primary text-white shadow-sm"
                          : "border border-line bg-raised text-ink hover:bg-canvas"
                      }`}
                    >
                      {CATEGORY_LABEL[cat as MoneyCategory]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Monto *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="Ej. 15000"
                  disabled={isPending}
                  className={`${inputClass} min-h-11 text-base font-bold`}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Método *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  disabled={isPending}
                  className={`${inputClass} min-h-11 text-base sm:text-sm`}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                  disabled={isPending}
                  className={`${inputClass} min-h-11 text-base sm:text-sm`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Descripción / Nota opcional
              </label>
              <input
                type="text"
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  formMode === "EXPENSE"
                    ? "Ej. 1 kg PETG negro, boquillas 0.4mm…"
                    : "Ej. Venta STL en Cults3D…"
                }
                disabled={isPending}
                className={`${inputClass} min-h-10 text-sm`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setFormMode(null)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-surface px-4 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 touch-manipulation"
              >
                {isPending
                  ? "Guardando…"
                  : formMode === "EXPENSE"
                    ? "Guardar gasto"
                    : "Guardar ingreso"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Tarjetas de resumen del mes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-4 sm:p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
            Ingresos del mes
          </span>
          <span className="mt-1 block text-2xl font-bold text-ok">
            {formatMoney(view.summary.income, currency)}
          </span>
        </Card>

        <Card className="p-4 sm:p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
            Gastos del mes
          </span>
          <span className="mt-1 block text-2xl font-bold text-danger">
            {formatMoney(view.summary.expense, currency)}
          </span>
        </Card>

        <Card className="p-4 sm:p-5 border-primary/25 bg-surface">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
            Ganancia neta
          </span>
          <span
            className={`mt-1 block text-2xl font-bold ${
              view.summary.profit >= 0 ? "text-ink" : "text-danger"
            }`}
          >
            {formatMoney(view.summary.profit, currency)}
          </span>
        </Card>
      </div>

      {/* Desglose por canal y por categoría */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Ingresos por canal
          </h2>
          {incomeChannels.length === 0 ? (
            <p className="text-xs text-muted">Sin ingresos activos en este mes.</p>
          ) : (
            <div className="space-y-2">
              {incomeChannels.map(([ch, amt]) => (
                <div
                  key={ch}
                  className="flex items-center justify-between text-sm border-b border-line/50 pb-1.5 last:border-b-0 last:pb-0"
                >
                  <span className="font-medium text-ink">
                    {CHANNEL_LABEL[ch as OrderChannel] ?? ch}
                  </span>
                  <span className="font-bold text-ok">
                    {formatMoney(amt, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Gastos por categoría
          </h2>
          {expenseCategories.length === 0 ? (
            <p className="text-xs text-muted">Sin gastos activos en este mes.</p>
          ) : (
            <div className="space-y-2">
              {expenseCategories.map(([cat, amt]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between text-sm border-b border-line/50 pb-1.5 last:border-b-0 last:pb-0"
                >
                  <span className="font-medium text-ink">
                    {CATEGORY_LABEL[cat as MoneyCategory] ?? cat}
                  </span>
                  <span className="font-bold text-danger">
                    {formatMoney(amt, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Lista de movimientos del mes con opción de anular */}
      <Card className="p-4 sm:p-6 space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-ink">
          Movimientos de {formatMonthLabel(view.month)} ({view.transactions.length})
        </h2>

        {view.transactions.length === 0 ? (
          <EmptyState
            title="Sin movimientos en este mes"
            description="Los cobros de ventas y los gastos registrados aparecerán aquí."
          />
        ) : (
          <div className="divide-y divide-line/70">
            {view.transactions.map((tx) => {
              const isVoided = tx.voidedAt !== null;
              const isVoidingThis = voidingId === tx.id;
              const categoryLabel =
                CATEGORY_LABEL[tx.category as MoneyCategory] ?? tx.category;
              const methodLabel =
                METHOD_LABEL[tx.method as PaymentMethod] ?? tx.method;

              return (
                <div key={tx.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div
                    className={`flex items-start sm:items-center justify-between gap-3 ${
                      isVoided ? "opacity-55" : ""
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isVoided ? "line-through text-muted" : "text-ink"
                          }`}
                        >
                          {categoryLabel}
                        </span>
                        <span className="text-xs text-muted">· {methodLabel}</span>
                        {tx.orderId && tx.orderNumber !== null && (
                          <Link
                            href={`/orders/${tx.orderId}`}
                            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary hover:underline"
                          >
                            {orderNumberLabel(tx.orderNumber)}
                          </Link>
                        )}
                        {isVoided && <Badge tone="danger">Anulado</Badge>}
                      </div>

                      <div className="text-xs text-muted">
                        <span>{tx.occurredOn}</span>
                        {tx.notes ? <span> · {tx.notes}</span> : null}
                        {isVoided && tx.voidReason ? (
                          <span> · Motivo de anulación: {tx.voidReason}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-sm sm:text-base font-bold ${
                          isVoided
                            ? "line-through text-muted"
                            : tx.type === "EXPENSE"
                              ? "text-danger"
                              : "text-ok"
                        }`}
                      >
                        {tx.type === "EXPENSE" ? "−" : "+"}
                        {formatMoney(tx.amount, currency)}
                      </span>

                      {!isVoided && !isVoidingThis && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setMessage(null);
                            setVoidingId(tx.id);
                            setVoidReason("");
                          }}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-2.5 text-xs font-medium text-muted hover:text-danger hover:border-danger/40 transition-colors touch-manipulation"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </div>

                  {isVoidingThis && (
                    <div className="rounded-xl border border-danger/30 bg-danger-soft/20 p-3 space-y-2.5">
                      <label className="block text-xs font-semibold text-danger">
                        Motivo de la anulación (obligatorio) *
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Ej. Monto mal ingresado, gasto duplicado…"
                        disabled={isPending}
                        className={`${inputClass} min-h-10 text-sm`}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setVoidingId(null);
                            setVoidReason("");
                          }}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-canvas touch-manipulation"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleVoid(tx.id)}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-danger px-3 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 touch-manipulation"
                        >
                          {isPending ? "Anulando…" : "Confirmar anulación"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

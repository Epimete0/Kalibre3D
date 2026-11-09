"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import {
  CATEGORY_LABEL,
  METHOD_LABEL,
  PAYMENT_METHODS,
  type MoneyCategory,
  type PaymentMethod,
} from "@/lib/money-presentation";
import type { OrderDetailPayment } from "@/lib/order-queries";
import type { OrderChannel, OrderStatus } from "@/lib/order-status";
import { formatDay } from "@/lib/date-labels";
import {
  registerPaymentAction,
  returnOrderAction,
  voidMoneyTransactionAction,
} from "../actions";

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

export function OrderMoneyControls({
  orderId,
  channel,
  status,
  version,
  currency,
  expectedReceivable,
  paidAmount,
  balance,
  transactions,
  canManageMoney,
  isViewer,
}: {
  orderId: string;
  channel: OrderChannel;
  status: OrderStatus;
  version: number;
  currency: string;
  expectedReceivable: number | null;
  paidAmount: number | null;
  balance: number | null;
  transactions: OrderDetailPayment[];
  canManageMoney: boolean;
  isViewer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const defaultMethod: PaymentMethod =
    channel === "MERCADOLIBRE" ? "MERCADOLIBRE" : "TRANSFER";
  const suggestedAmount =
    balance !== null && balance > 0
      ? balance
      : expectedReceivable !== null && expectedReceivable > 0
        ? expectedReceivable
        : 0;

  const [showPaymentForm, setShowPaymentForm] = useState(
    canManageMoney && status !== "CANCELED" && status !== "RETURNED" && (balance ?? 0) > 0
  );
  const [paymentOpId, setPaymentOpId] = useState<string>(() => makeUuid());
  const [amountStr, setAmountStr] = useState<string>(
    suggestedAmount > 0 ? String(suggestedAmount) : ""
  );
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [notes, setNotes] = useState("");

  // Estado de anulación por movimiento
  const [voidingTxId, setVoidingTxId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Estado de devolución (D6)
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnOpId, setReturnOpId] = useState<string>(() => makeUuid());
  const defaultRefund =
    paidAmount !== null && paidAmount > 0
      ? paidAmount
      : expectedReceivable !== null && expectedReceivable > 0
        ? expectedReceivable
        : 0;
  const [refundAmountStr, setRefundAmountStr] = useState<string>(
    defaultRefund > 0 ? String(defaultRefund) : ""
  );
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>(defaultMethod);
  const [refundNotes, setRefundNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const amount = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El monto del cobro debe ser mayor a 0.");
      return;
    }

    startTransition(async () => {
      const res = await registerPaymentAction({
        orderId,
        operationId: paymentOpId,
        amount,
        method,
        notes: notes.trim() || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Cobro registrado correctamente.");
        setPaymentOpId(makeUuid());
        setNotes("");
        setShowPaymentForm(false);
        router.refresh();
      }
    });
  }

  function handleVoidTransaction(txId: string) {
    setError(null);
    setMessage(null);
    if (!voidReason.trim()) {
      setError("Debes indicar el motivo de la anulación.");
      return;
    }

    startTransition(async () => {
      const res = await voidMoneyTransactionAction({
        orderId,
        transactionId: txId,
        reason: voidReason.trim(),
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Movimiento anulado correctamente.");
        setVoidingTxId(null);
        setVoidReason("");
        router.refresh();
      }
    });
  }

  function handleReturnOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const refundAmount = Number.parseInt(refundAmountStr, 10);
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      setError("El monto devuelto debe ser mayor a 0.");
      return;
    }

    startTransition(async () => {
      const res = await returnOrderAction({
        orderId,
        expectedVersion: version,
        operationId: returnOpId,
        refundAmount,
        method: refundMethod,
        notes: refundNotes.trim() || null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Devolución registrada correctamente.");
        setReturnOpId(makeUuid());
        setShowReturnForm(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base sm:text-lg font-bold text-ink">
          Cobros y movimientos
        </h2>

        {canManageMoney && (
          <div className="flex flex-wrap items-center gap-2">
            {status !== "CANCELED" && status !== "RETURNED" && !showPaymentForm && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  if (balance !== null && balance > 0) {
                    setAmountStr(String(balance));
                  }
                  setShowPaymentForm(true);
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-hover transition-colors touch-manipulation"
              >
                + Registrar cobro
              </button>
            )}

            {status === "DELIVERED" && !showReturnForm && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  setShowReturnForm(true);
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-danger/30 bg-surface px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger-soft transition-colors touch-manipulation"
              >
                Registrar devolución
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs sm:text-sm font-medium text-danger"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-ok/30 bg-ok-soft px-3.5 py-2.5 text-xs sm:text-sm font-medium text-ok"
        >
          {message}
        </div>
      )}

      {/* Formulario de cobro (táctil para móvil 390px) */}
      {canManageMoney && showPaymentForm && (
        <form
          onSubmit={handleRegisterPayment}
          className="rounded-xl border border-primary/25 bg-canvas/70 p-3.5 sm:p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-bold text-ink">
              Nuevo cobro de venta
            </span>
            {balance !== null && balance > 0 && (
              <button
                type="button"
                onClick={() => setAmountStr(String(balance))}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Usar saldo ({formatMoney(balance, currency)})
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Monto recibido *
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={isPending}
                className={`${inputClass} min-h-11 text-base font-bold`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Método de pago *
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">
              Nota opcional
            </label>
            <input
              type="text"
              maxLength={200}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Abono 50%, pago contra entrega…"
              disabled={isPending}
              className={`${inputClass} min-h-10 text-sm`}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowPaymentForm(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 touch-manipulation"
            >
              {isPending ? "Guardando…" : "Guardar cobro"}
            </button>
          </div>
        </form>
      )}

      {/* Formulario de devolución atómica (D6) */}
      {canManageMoney && showReturnForm && status === "DELIVERED" && (
        <form
          onSubmit={handleReturnOrder}
          className="rounded-xl border border-danger/40 bg-danger-soft/20 p-3.5 sm:p-4 space-y-3"
        >
          <div className="space-y-0.5">
            <span className="text-xs sm:text-sm font-bold text-danger block">
              Registrar devolución y reembolso (D6)
            </span>
            <p className="text-xs text-muted">
              El pedido pasará a estado <strong>Devuelto</strong> y se registrará un gasto por devolución en una sola operación.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Monto devuelto *
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                required
                value={refundAmountStr}
                onChange={(e) => setRefundAmountStr(e.target.value)}
                disabled={isPending}
                className={`${inputClass} min-h-11 text-base font-bold`}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Método de reembolso *
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as PaymentMethod)}
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
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">
              Motivo o nota de la devolución
            </label>
            <input
              type="text"
              maxLength={300}
              value={refundNotes}
              onChange={(e) => setRefundNotes(e.target.value)}
              placeholder="Ej. Reclamo en Mercado Libre, pieza no calzó…"
              disabled={isPending}
              className={`${inputClass} min-h-10 text-sm`}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowReturnForm(false)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-surface px-3.5 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-danger px-4 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-50 touch-manipulation"
            >
              {isPending ? "Procesando…" : "Confirmar devolución"}
            </button>
          </div>
        </form>
      )}

      {/* Lista de cobros y movimientos */}
      {transactions.length === 0 ? (
        <p className="text-xs sm:text-sm text-muted">
          Aún no se han registrado cobros para este pedido.
        </p>
      ) : (
        <div className="divide-y divide-line/70">
          {transactions.map((tx) => {
            const isVoided = tx.voidedAt !== null;
            const isVoidingThis = voidingTxId === tx.id;
            const methodLabel =
              METHOD_LABEL[tx.method as PaymentMethod] ?? tx.method;
            const categoryLabel =
              CATEGORY_LABEL[tx.category as MoneyCategory] ?? tx.category;

            return (
              <div key={tx.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                <div
                  className={`flex items-center justify-between gap-3 ${
                    isVoided ? "opacity-55" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          isVoided ? "line-through text-muted" : "text-ink"
                        }`}
                      >
                        {categoryLabel} · {methodLabel}
                      </span>
                      {isVoided && <Badge tone="danger">Anulado</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      Fecha: {formatDay(tx.occurredOn)}
                      {tx.notes ? ` · ${tx.notes}` : ""}
                      {isVoided && tx.voidReason
                        ? ` · Motivo: ${tx.voidReason}`
                        : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {!isViewer && tx.amount !== null && (
                      <div
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
                      </div>
                    )}

                    {canManageMoney && !isVoided && !isVoidingThis && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setMessage(null);
                          setVoidingTxId(tx.id);
                          setVoidReason("");
                        }}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-2.5 text-xs font-medium text-muted hover:text-danger hover:border-danger/40 transition-colors touch-manipulation"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </div>

                {canManageMoney && isVoidingThis && (
                  <div className="rounded-xl border border-danger/30 bg-danger-soft/20 p-3 space-y-2.5">
                    <label className="block text-xs font-semibold text-danger">
                      Motivo de la anulación (obligatorio) *
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Ej. Monto mal escrito, cobro duplicado…"
                      disabled={isPending}
                      className={`${inputClass} min-h-10 text-sm`}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setVoidingTxId(null);
                          setVoidReason("");
                        }}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-canvas touch-manipulation"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleVoidTransaction(tx.id)}
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
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUS_ACTION_LABEL, STATUS_LABEL } from "@/lib/order-presentation";
import { nextStatuses, type OrderStatus } from "@/lib/order-status";
import { changeOrderStatusAction } from "../actions";

export function OrderDetailStatusControls({
  orderId,
  currentStatus,
  version,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  version: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // En Tarea 1.6 el avance de estado excluye RETURNED (que requiere gasto de reembolso en 1.7)
  const availableTransitions = nextStatuses(currentStatus).filter(
    (s) => s !== "RETURNED"
  );

  if (availableTransitions.length === 0) {
    return null;
  }

  const forwardStatuses = availableTransitions.filter((s) => s !== "CANCELED");
  const canCancel = availableTransitions.includes("CANCELED");

  function handleTransition(to: OrderStatus) {
    setError(null);
    setSuccessMessage(null);
    startTransition(async () => {
      const res = await changeOrderStatusAction({
        orderId,
        expectedVersion: version,
        to,
      });
      if (res.error) {
        setError(res.error);
        setConfirmCancel(false);
      } else {
        setSuccessMessage(res.message ?? `Estado actualizado a ${STATUS_LABEL[to]}.`);
        setConfirmCancel(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3 border-t border-line/70 pt-4">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs sm:text-sm font-medium text-danger"
        >
          {error}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-ok/30 bg-ok-soft px-3.5 py-2.5 text-xs sm:text-sm font-medium text-ok"
        >
          {successMessage}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {forwardStatuses.map((status) => (
            <button
              key={status}
              type="button"
              disabled={isPending}
              onClick={() => handleTransition(status)}
              className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 transition-colors touch-manipulation"
            >
              {isPending ? "Guardando…" : STATUS_ACTION_LABEL[status]}
            </button>
          ))}
        </div>

        {canCancel && (
          <div className="flex items-center gap-2">
            {!confirmCancel ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setConfirmCancel(true)}
                className="w-full sm:w-auto inline-flex min-h-11 items-center justify-center rounded-xl border border-danger/30 bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-danger hover:bg-danger-soft disabled:opacity-50 transition-colors touch-manipulation"
              >
                Cancelar pedido
              </button>
            ) : (
              <div className="flex w-full sm:w-auto items-center gap-2 rounded-xl border border-danger/40 bg-danger-soft/50 p-1.5">
                <span className="px-2 text-xs font-semibold text-danger">
                  ¿Confirmar cancelación?
                </span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleTransition("CANCELED")}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-danger px-3 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 touch-manipulation"
                >
                  {isPending ? "Cancelando…" : "Sí, cancelar"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setConfirmCancel(false)}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-surface px-2.5 text-xs font-medium text-ink hover:bg-canvas touch-manipulation"
                >
                  No
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { STATUS_ACTION_LABEL, STATUS_LABEL } from "@/lib/order-presentation";
import { ORDER_STAGES, STAGE_MEANING, STAGE_WHEN, isOrderStage, stageIndex } from "@/lib/order-stages";
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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // El avance excluye RETURNED (requiere registrar la devolución) y CANCELED (anular vive en OrderVoidButton).
  const forwardStatuses = nextStatuses(currentStatus).filter(
    (s) => s !== "RETURNED" && s !== "CANCELED"
  );

  const currentIndex = stageIndex(currentStatus);
  if (forwardStatuses.length === 0 && currentIndex < 0) {
    return null;
  }

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
      } else {
        setSuccessMessage(res.message ?? `Estado actualizado a ${STATUS_LABEL[to]}.`);
        router.refresh();
      }
    });
  }

  const nextStage = forwardStatuses.find(isOrderStage);

  return (
    <div className="space-y-3 border-t border-line/70 pt-4">
      {currentIndex >= 0 && (
        <div>
          <ol aria-label="Etapas del pedido" className="grid grid-cols-5 gap-1">
            {ORDER_STAGES.map((stage, index) => {
              const done = index < currentIndex;
              const current = index === currentIndex;
              return (
                <li key={stage} aria-current={current ? "step" : undefined} className="min-w-0 text-center">
                  <span
                    aria-hidden="true"
                    className={`mx-auto mb-1 block h-1.5 rounded-full ${done || current ? "bg-primary" : "bg-line-strong"}`}
                  />
                  <span className={`block break-words text-[10px] leading-tight ${current ? "font-bold text-ink" : done ? "text-muted" : "text-faint"}`}>
                    {STATUS_LABEL[stage]}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-sm text-ink">
            <strong>Ahora:</strong> {STAGE_MEANING[ORDER_STAGES[currentIndex]]}
          </p>
          {nextStage && <p className="mt-0.5 text-xs text-muted">Siguiente paso: {STAGE_WHEN[nextStage]}</p>}
        </div>
      )}
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

      {forwardStatuses.length > 0 && (
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
      )}
    </div>
  );
}

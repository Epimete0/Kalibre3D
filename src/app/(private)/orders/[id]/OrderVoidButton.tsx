"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Dialog, useCloseDialog } from "@/components/Dialog";
import { changeOrderStatusAction } from "../actions";

/** Anular un pedido registrado por error: queda en una esquina y siempre pide confirmación en una ventana. */
export function OrderVoidButton({ orderId, version, orderLabel }: { orderId: string; version: number; orderLabel: string }) {
  return (
    <Dialog
      triggerLabel="Anular pedido por error"
      triggerContent={
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
          <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.5 5.5l.7 10.1a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-10.1M8.5 9v4.5M11.5 9v4.5" />
        </svg>
      }
      triggerClassName="inline-flex h-10 w-10 items-center justify-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/35 touch-manipulation"
      title={`Anular ${orderLabel}`}
      description="Solo para un pedido registrado por error."
    >
      <VoidConfirmation orderId={orderId} version={version} />
    </Dialog>
  );
}

function VoidConfirmation({ orderId, version }: { orderId: string; version: number }) {
  const router = useRouter();
  const close = useCloseDialog();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await changeOrderStatusAction({ orderId, expectedVersion: version, to: "CANCELED" });
      if (res.error) {
        setError(res.error);
        return;
      }
      close();
      router.push("/orders");
    });
  }

  return (
    <div className="space-y-4 text-sm">
      <ul className="list-disc space-y-1 pl-5 text-muted">
        <li>El pedido se oculta de tus listas y de las cuentas.</li>
        <li>Sus cobros se anulan y el filamento y stock vinculados vuelven a su lugar.</li>
        <li>No devuelve dinero al cliente. Si fue una venta real que te devolvieron, registra una devolución en el pedido.</li>
      </ul>

      {error && (
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={isPending}
          onClick={close}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50 touch-manipulation"
        >
          No, volver
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={confirm}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-danger px-4 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 touch-manipulation"
        >
          {isPending ? "Anulando…" : "Sí, anular pedido"}
        </button>
      </div>
    </div>
  );
}

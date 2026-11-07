"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordProductMovementAction } from "@/app/(private)/products/actions";
import { Card, Field, inputClass } from "@/components/ui";

const primaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";

export function ProductStockControls({
  productId,
  currentStock,
}: {
  productId: string;
  currentStock: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"ENTRY" | "EXIT" | "ADJUST">("ENTRY");
  const [delta, setDelta] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const parsed = Number.parseInt(delta, 10);
    if (!Number.isFinite(parsed) || parsed === 0) {
      setError("Ingresa una cantidad entera distinta de 0.");
      return;
    }

    const opId = crypto.randomUUID();
    startTransition(async () => {
      const res = await recordProductMovementAction({
        operationId: opId,
        productId,
        kind,
        delta: parsed,
        notes: notes.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Stock actualizado correctamente.");
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">Registrar movimiento de stock</h2>
        <span className="text-sm font-bold text-ink">Stock actual: {currentStock} u.</span>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-xs text-ok">
          {message}
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-4 items-end">
        <Field label="Tipo de movimiento">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "ENTRY" | "EXIT" | "ADJUST")}
            className={inputClass}
          >
            <option value="ENTRY">Fabricación / Entrada (+)</option>
            <option value="EXIT">Salida / Entrega (-)</option>
            <option value="ADJUST">Ajuste de inventario (+ o -)</option>
          </select>
        </Field>

        <Field label={kind === "ADJUST" ? "Variación (+ o -)" : "Cantidad de unidades"}>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            required
            className={inputClass}
          />
        </Field>

        <Field label="Nota (opcional)">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. Lote impreso hoy"
            className={inputClass}
          />
        </Field>

        <button type="submit" disabled={isPending} className={primaryBtn}>
          {isPending ? "Guardando…" : "Registrar movimiento"}
        </button>
      </form>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordSpoolMovementAction } from "@/app/(private)/spools/actions";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { MATERIAL_LABEL } from "@/lib/catalog-presentation";
import type { OrderDetailSpoolMovement } from "@/lib/order-queries";

export type OrderSpoolOption = {
  id: string;
  material: string;
  color: string;
  brand: string | null;
  remainingGrams: number;
};

export function OrderSpoolControls({
  orderId,
  orderNumber,
  items,
  spoolMovements,
  activeSpools,
  canManage,
}: {
  orderId: string;
  orderNumber: number;
  items: Array<{
    description: string;
    qty: number;
    material: string | null;
    grams: number | null;
  }>;
  spoolMovements: OrderDetailSpoolMovement[];
  activeSpools: OrderSpoolOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const estimatedGrams = items.reduce(
    (sum, item) => sum + Math.max(0, item.grams ?? 0) * item.qty,
    0
  );
  const alreadyDeductedGrams = spoolMovements.reduce(
    (sum, mov) => sum + (mov.deltaGrams < 0 ? Math.abs(mov.deltaGrams) : 0),
    0
  );
  const pendingSuggestedGrams = Math.max(0, estimatedGrams - alreadyDeductedGrams);

  const preferredMaterial = items.find((i) => i.material)?.material ?? null;
  const defaultSpoolId =
    (preferredMaterial
      ? activeSpools.find((s) => s.material === preferredMaterial)?.id
      : undefined) ??
    activeSpools[0]?.id ??
    "";

  const [selectedSpoolId, setSelectedSpoolId] = useState(defaultSpoolId);
  const [gramsInput, setGramsInput] = useState(
    String(pendingSuggestedGrams > 0 ? pendingSuggestedGrams : estimatedGrams > 0 ? estimatedGrams : 50)
  );
  const [notes, setNotes] = useState("");

  function handleDeduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedGrams = Math.round(Number(gramsInput) || 0);
    if (!selectedSpoolId) {
      setError("Selecciona una bobina activa.");
      return;
    }
    if (parsedGrams <= 0) {
      setError("Ingresa una cantidad de gramos mayor a 0.");
      return;
    }

    const opId = crypto.randomUUID();
    startTransition(async () => {
      const res = await recordSpoolMovementAction({
        operationId: opId,
        spoolId: selectedSpoolId,
        kind: "CONSUME",
        deltaGrams: parsedGrams,
        orderId,
        notes: notes.trim() || `Pedido #${orderNumber}`,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setNotes("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-ink">
            Filamento usado en este pedido
          </h2>
          <p className="text-xs text-muted">
            {estimatedGrams > 0
              ? `Estimado según las piezas: ${estimatedGrams} g · Descontado: ${alreadyDeductedGrams} g`
              : `Descontado en bobinas: ${alreadyDeductedGrams} g`}
          </p>
        </div>
        {alreadyDeductedGrams > 0 && (
          <Badge tone="ok">{alreadyDeductedGrams} g descontados</Badge>
        )}
      </div>

      {spoolMovements.length > 0 && (
        <div className="divide-y divide-line/70 rounded-xl border border-line bg-raised/30 px-3.5">
          {spoolMovements.map((mov) => (
            <div key={mov.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
              <div>
                <Link
                  href={`/spools/${mov.spoolId}`}
                  className="font-semibold text-ink hover:text-primary hover:underline"
                >
                  {MATERIAL_LABEL[mov.material as keyof typeof MATERIAL_LABEL] ?? mov.material} ·{" "}
                  {mov.color}
                  {mov.brand ? ` (${mov.brand})` : ""}
                </Link>
                {mov.notes && <span className="text-muted"> · {mov.notes}</span>}
              </div>
              <div className="text-right tabular-nums shrink-0">
                <span className="font-bold text-amber-600">
                  {mov.deltaGrams > 0 ? `+${mov.deltaGrams}` : mov.deltaGrams} g
                </span>
                <span className="text-muted ml-2">(quedan {mov.resultingGrams} g)</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      {canManage && activeSpools.length > 0 && (
        <form onSubmit={handleDeduct} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end pt-1">
          <div className="sm:col-span-5">
            <Field label="Bobina activa">
              <select
                value={selectedSpoolId}
                onChange={(e) => setSelectedSpoolId(e.target.value)}
                className={inputClass}
              >
                {activeSpools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {MATERIAL_LABEL[s.material as keyof typeof MATERIAL_LABEL] ?? s.material} · {s.color}
                    {s.brand ? ` (${s.brand})` : ""} — {s.remainingGrams} g disp.
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Gramos (g)">
              <input
                type="number"
                min="1"
                required
                value={gramsInput}
                onChange={(e) => setGramsInput(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-3">
            <Field label="Nota (opcional)">
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Pedido #${orderNumber}`}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex w-full min-h-10 items-center justify-center rounded-xl bg-primary px-3 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              {isPending ? "…" : "Descontar"}
            </button>
          </div>
        </form>
      )}

      {canManage && activeSpools.length === 0 && (
        <p className="text-xs text-muted">
          No tienes bobinas activas registradas.{" "}
          <Link href="/spools" className="font-semibold text-primary hover:underline">
            Registrar una bobina →
          </Link>
        </p>
      )}
    </Card>
  );
}

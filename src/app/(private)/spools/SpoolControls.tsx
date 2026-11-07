"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  createSpoolAction,
  recordSpoolMovementAction,
  toggleSpoolActiveAction,
  updateSpoolAction,
  type SpoolActionState,
} from "@/app/(private)/spools/actions";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import { MATERIALS, MATERIAL_LABEL } from "@/lib/catalog-presentation";
import { formatMoney } from "@/lib/money-format";
import { METHOD_LABEL, PAYMENT_METHODS } from "@/lib/money-presentation";
import type { SpoolListItem } from "@/lib/spool-queries";

const initialState: SpoolActionState = {};

const primaryBtn =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";
const secondaryBtn =
  "inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60";

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
      {message}
    </p>
  );
}

export function SpoolCreateModal({
  currency,
  defaultCostPerKg,
}: {
  currency: string;
  defaultCostPerKg: number;
}) {
  const [open, setOpen] = useState(false);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const [recordExpense, setRecordExpense] = useState(true);

  const [state, formAction, isPending] = useActionState(
    async (prev: SpoolActionState, formData: FormData) => {
      const res = await createSpoolAction(prev, formData);
      if (res.ok) {
        setOperationId(crypto.randomUUID());
        setOpen(false);
      }
      return res;
    },
    initialState
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={primaryBtn}>
        + Nueva bobina
      </button>
    );
  }

  return (
    <Card className="p-4 sm:p-5 space-y-4 border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">Registrar nueva bobina</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-muted hover:text-ink min-h-[36px] px-2"
        >
          Cerrar
        </button>
      </div>

      {state.error && <ErrorMessage message={state.error} />}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="operationId" value={operationId} />
        <input type="hidden" name="currency" value={currency} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Material">
            <select name="material" defaultValue="PETG" className={inputClass}>
              {MATERIALS.map((m) => (
                <option key={m} value={m}>
                  {MATERIAL_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Color">
            <input name="color" required placeholder="Ej. Negro, Blanco, Rojo" className={inputClass} />
          </Field>

          <Field label="Marca (opcional)">
            <input name="brand" placeholder="Ej. eSUN, Sunlu, Creality" className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Peso total (g)">
            <input name="totalGrams" type="number" min={1} max={50000} defaultValue={1000} required className={inputClass} />
          </Field>

          <Field label="Gramos actuales (g)">
            <input name="remainingGrams" type="number" min={0} max={50000} defaultValue={1000} className={inputClass} />
          </Field>

          <Field label={`Precio pagado (${currency})`}>
            <input
              name="pricePaid"
              inputMode="decimal"
              defaultValue={String(defaultCostPerKg)}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Fecha de compra">
            <input name="purchasedOn" type="date" className={inputClass} />
          </Field>
        </div>

        <div className="rounded-lg border border-line bg-raised/50 p-3 space-y-2.5">
          <label className="flex items-center gap-2.5 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              name="recordExpenseInMoney"
              checked={recordExpense}
              onChange={(e) => setRecordExpense(e.target.checked)}
              className="h-4 w-4 rounded border-line"
            />
            <span>Registrar automáticamente este monto como gasto de filamento en Dinero</span>
          </label>

          {recordExpense && (
            <div className="max-w-xs">
              <Field label="Método de pago del gasto">
                <select name="paymentMethod" defaultValue="TRANSFER" className={inputClass}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>

        <Field label="Notas (opcional)">
          <input name="notes" maxLength={500} placeholder="Lote, temperatura recomendada, etc." className={inputClass} />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className={primaryBtn}>
            {isPending ? "Guardando…" : "Guardar bobina"}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function SpoolQuickConsumeCard({
  spool,
  currency,
  canOperate,
}: {
  spool: SpoolListItem;
  currency: string;
  canOperate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customGrams, setCustomGrams] = useState("50");
  const [customNotes, setCustomNotes] = useState("");
  const [customKind, setCustomKind] = useState<"CONSUME" | "ADJUST">("CONSUME");

  function handleQuickConsume(grams: number) {
    setError(null);
    const opId = crypto.randomUUID();
    startTransition(async () => {
      const res = await recordSpoolMovementAction({
        operationId: opId,
        spoolId: spool.id,
        kind: "CONSUME",
        deltaGrams: grams,
        notes: `Descuento rápido (-${grams} g)`,
      });
      if (res.error) {
        setError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number.parseInt(customGrams, 10);
    if (!Number.isFinite(parsed) || parsed === 0) {
      setError("Ingresa una cantidad entera de gramos distinta de 0.");
      return;
    }
    const opId = crypto.randomUUID();
    startTransition(async () => {
      const res = await recordSpoolMovementAction({
        operationId: opId,
        spoolId: spool.id,
        kind: customKind,
        deltaGrams: parsed,
        notes: customNotes.trim() || undefined,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setShowCustom(false);
        setCustomNotes("");
        router.refresh();
      }
    });
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/spools/${spool.id}`}
              className="text-base font-semibold text-ink hover:text-primary hover:underline"
            >
              {MATERIAL_LABEL[spool.material as keyof typeof MATERIAL_LABEL] ?? spool.material} · {spool.color}
            </Link>
            {spool.brand && <Badge tone="neutral">{spool.brand}</Badge>}
            {!spool.active && <Badge tone="neutral">Inactiva</Badge>}
            {spool.isLow && <Badge tone="warn">Poco filamento</Badge>}
          </div>
          {spool.pricePaid !== null && (
            <p className="text-xs text-muted mt-0.5">
              Pagado: {formatMoney(spool.pricePaid, currency)}
              {spool.costPerGram !== null ? ` · ~${formatMoney(Math.round(spool.costPerGram), currency)}/g` : ""}
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-ink tabular-nums">
            {spool.remainingGrams} g
          </div>
          <div className="text-xs text-muted tabular-nums">
            de {spool.totalGrams} g ({spool.remainingPct}%)
          </div>
        </div>
      </div>

      {/* Barra visual de filamento restante */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised">
        <div
          className={`h-full rounded-full transition-all ${
            spool.isLow ? "bg-amber-500" : "bg-emerald-600"
          }`}
          style={{ width: `${Math.max(2, spool.remainingPct)}%` }}
        />
      </div>

      {error && <ErrorMessage message={error} />}

      {canOperate && spool.active && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[20, 50, 100].map((g) => (
                <button
                  key={g}
                  type="button"
                  disabled={isPending || spool.remainingGrams < g}
                  onClick={() => handleQuickConsume(g)}
                  className="min-h-[36px] rounded-lg border border-line bg-raised px-2.5 py-1 text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-40"
                >
                  -{g} g
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustom((v) => !v)}
                className="min-h-[36px] rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:text-ink"
              >
                {showCustom ? "Cerrar" : "Otro / Ajustar"}
              </button>
            </div>

            <Link
              href={`/spools/${spool.id}`}
              className="text-xs font-semibold text-primary hover:underline min-h-[36px] inline-flex items-center"
            >
              Ver historial →
            </Link>
          </div>

          {showCustom && (
            <form onSubmit={handleCustomSubmit} className="rounded-lg border border-line bg-raised/50 p-3 space-y-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Tipo">
                  <select
                    value={customKind}
                    onChange={(e) => setCustomKind(e.target.value as "CONSUME" | "ADJUST")}
                    className={inputClass}
                  >
                    <option value="CONSUME">Descontar consumo (-g)</option>
                    <option value="ADJUST">Ajuste (+ o - g)</option>
                  </select>
                </Field>
                <Field label={customKind === "CONSUME" ? "Gramos usados" : "Variación (+ o - g)"}>
                  <input
                    type="number"
                    value={customGrams}
                    onChange={(e) => setCustomGrams(e.target.value)}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="Nota (opcional)">
                  <input
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Ej. Impresión fallida"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="submit" disabled={isPending} className={primaryBtn}>
                  {isPending ? "Guardando…" : "Aplicar"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

export function SpoolDetailEditControls({
  spool,
  currency,
}: {
  spool: SpoolListItem;
  currency: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPendingToggle, startTransition] = useTransition();
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [state, formAction, isSaving] = useActionState(
    async (prev: SpoolActionState, formData: FormData) => {
      const res = await updateSpoolAction(prev, formData);
      if (res.ok) {
        setEditing(false);
      }
      return res;
    },
    initialState
  );

  function handleToggleActive() {
    setToggleError(null);
    startTransition(async () => {
      const res = await toggleSpoolActiveAction({ id: spool.id, active: !spool.active });
      if (res.error) {
        setToggleError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {toggleError && <ErrorMessage message={toggleError} />}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryBtn} onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancelar edición" : "Editar datos"}
        </button>
        <button
          type="button"
          className={secondaryBtn}
          disabled={isPendingToggle}
          onClick={handleToggleActive}
        >
          {isPendingToggle ? "Actualizando…" : spool.active ? "Desactivar bobina" : "Reactivar bobina"}
        </button>
      </div>

      {editing && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-ink">Editar datos de la bobina</h3>
          {state.error && <ErrorMessage message={state.error} />}
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="id" value={spool.id} />
            <input type="hidden" name="currency" value={currency} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Material">
                <select name="material" defaultValue={spool.material} className={inputClass}>
                  {MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {MATERIAL_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Color">
                <input name="color" defaultValue={spool.color} required className={inputClass} />
              </Field>
              <Field label="Marca">
                <input name="brand" defaultValue={spool.brand ?? ""} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Peso total inicial (g)">
                <input name="totalGrams" type="number" min={1} max={50000} defaultValue={spool.totalGrams} required className={inputClass} />
              </Field>
              <Field label={`Precio pagado (${currency})`}>
                <input name="pricePaid" inputMode="decimal" defaultValue={String(spool.pricePaid ?? 0)} required className={inputClass} />
              </Field>
              <Field label="Fecha de compra">
                <input name="purchasedOn" type="date" defaultValue={spool.purchasedOn} required className={inputClass} />
              </Field>
            </div>
            <Field label="Notas">
              <input name="notes" defaultValue={spool.notes ?? ""} maxLength={500} className={inputClass} />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="submit" disabled={isSaving} className={primaryBtn}>
                {isSaving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

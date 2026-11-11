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
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-hover px-4 text-xs font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(217,83,30,0.25)] ring-1 ring-inset ring-white/20 transition-all hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60 touch-manipulation";
const secondaryBtn =
  "inline-flex min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition-all hover:bg-raised hover:border-line-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:opacity-60 touch-manipulation";

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-xs text-danger">
      {message}
    </p>
  );
}

/** Pesos habituales de una bobina; 1 kg viene marcado porque es lo más común. */
const SPOOL_WEIGHTS = [
  { grams: 250, label: "250 g" },
  { grams: 500, label: "500 g" },
  { grams: 1000, label: "1 kg" },
  { grams: 3000, label: "3 kg" },
] as const;

/** Colores frecuentes de filamento con su muestra; también se puede escribir otro. */
const COMMON_COLORS = [
  { name: "Negro", hex: "#111111" },
  { name: "Blanco", hex: "#f5f5f5" },
  { name: "Gris", hex: "#8a8f98" },
  { name: "Rojo", hex: "#d32f2f" },
  { name: "Azul", hex: "#1e5bd8" },
  { name: "Verde", hex: "#2e7d32" },
  { name: "Amarillo", hex: "#f4c20d" },
  { name: "Naranja", hex: "#f57c00" },
  { name: "Plata", hex: "#c0c4c8" },
  { name: "Transparente", hex: "transparent" },
] as const;

const chipClass = (selected: boolean) =>
  `inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-150 touch-manipulation ${
    selected
      ? "border-primary/40 bg-primary-soft text-primary-ink font-bold shadow-xs ring-1 ring-primary/20"
      : "border-line bg-surface text-ink hover:border-line-strong hover:bg-raised"
  }`;

export function SpoolCreateModal({
  currency,
  defaultCostPerKg,
  initialOpen = false,
  welcome = false,
}: {
  currency: string;
  defaultCostPerKg: number;
  /** Abre el formulario al entrar (por ejemplo desde los primeros pasos). */
  initialOpen?: boolean;
  /** Inicio guiado: al guardar sigue con la primera venta. */
  welcome?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  // Una bobina que ya se tenía no es una compra: no debe aparecer como gasto en Dinero.
  // En el inicio guiado viene marcada "Ya la tenía"; en el resto se pide elegir.
  const [acquisition, setAcquisition] = useState<"PURCHASED" | "OWNED" | null>(welcome ? "OWNED" : null);
  const recordExpense = acquisition === "PURCHASED";
  const [material, setMaterial] = useState<string>("PETG");
  const [color, setColor] = useState("");
  const [weightChoice, setWeightChoice] = useState<number | "OTHER">(1000);
  const [customGrams, setCustomGrams] = useState("");
  const [usedAlready, setUsedAlready] = useState(false);
  const [remaining, setRemaining] = useState("");
  const [price, setPrice] = useState(String(defaultCostPerKg));

  const totalGrams = weightChoice === "OTHER" ? Math.max(0, Math.round(Number(customGrams) || 0)) : weightChoice;
  const priceNumber = Number(price.replace(",", ".")) || 0;
  const pricePerKg = totalGrams > 0 ? Math.round((priceNumber * 1000) / totalGrams) : 0;
  const pricePerGram = totalGrams > 0 ? priceNumber / totalGrams : 0;

  const [state, formAction, isPending] = useActionState(
    async (prev: SpoolActionState, formData: FormData) => {
      const res = await createSpoolAction(prev, formData);
      if (res.ok) {
        setOperationId(crypto.randomUUID());
        setOpen(false);
        if (welcome) router.push("/orders/new");
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
    <Card className="w-full p-4 sm:p-5 space-y-4 border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{welcome ? "Tu primera bobina" : "Registrar nueva bobina"}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-muted hover:text-ink min-h-[36px] px-2"
        >
          Cerrar
        </button>
      </div>

      {state.error && <ErrorMessage message={state.error} />}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="operationId" value={operationId} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="material" value={material} />
        <input type="hidden" name="totalGrams" value={totalGrams || ""} />
        <input type="hidden" name="remainingGrams" value={usedAlready ? remaining : String(totalGrams || "")} />

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">Material</legend>
          <div className="flex flex-wrap gap-1.5">
            {MATERIALS.map((m) => (
              <button key={m} type="button" aria-pressed={material === m} onClick={() => setMaterial(m)} className={chipClass(material === m)}>
                {MATERIAL_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">Color</legend>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_COLORS.map((c) => (
              <button
                key={c.name}
                type="button"
                aria-pressed={color === c.name}
                onClick={() => setColor(c.name)}
                className={chipClass(color === c.name)}
              >
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 rounded-full border border-line-strong"
                  style={{
                    background:
                      c.hex === "transparent"
                        ? "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%) 50% / 6px 6px"
                        : c.hex,
                  }}
                />
                {c.name}
              </button>
            ))}
          </div>
          <label htmlFor="spool-color" className="sr-only">
            Color del filamento
          </label>
          <input
            id="spool-color"
            name="color"
            required
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="U otro: Azul petróleo, Seda dorado…"
            className={`${inputClass} mt-2`}
          />
        </fieldset>

        <Field label="Marca (opcional)" htmlFor="spool-brand">
          <input id="spool-brand" name="brand" placeholder="Ej. eSUN, Sunlu, Creality" className={inputClass} />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink">¿Cuánto trae la bobina?</legend>
          <div className="flex flex-wrap gap-1.5">
            {SPOOL_WEIGHTS.map((w) => (
              <button
                key={w.grams}
                type="button"
                aria-pressed={weightChoice === w.grams}
                onClick={() => setWeightChoice(w.grams)}
                className={chipClass(weightChoice === w.grams)}
              >
                {w.label}
              </button>
            ))}
            <button type="button" aria-pressed={weightChoice === "OTHER"} onClick={() => setWeightChoice("OTHER")} className={chipClass(weightChoice === "OTHER")}>
              Otro
            </button>
          </div>
          {weightChoice === "OTHER" && (
            <div className="mt-2 max-w-xs">
              <Field label="Gramos de la bobina" htmlFor="spool-custom-grams">
                <input
                  id="spool-custom-grams"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50000}
                  required
                  value={customGrams}
                  onChange={(e) => setCustomGrams(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
          <label className="mt-2 flex min-h-9 items-center gap-2 text-xs text-ink cursor-pointer">
            <input type="checkbox" checked={usedAlready} onChange={(e) => setUsedAlready(e.target.checked)} className="h-4 w-4 rounded border-line" />
            <span>Ya la empecé a usar</span>
          </label>
          {usedAlready && (
            <div className="mt-1 max-w-xs">
              <Field label="Gramos que le quedan (aprox.)" htmlFor="spool-remaining">
                <input
                  id="spool-remaining"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={totalGrams || 50000}
                  required
                  value={remaining}
                  onChange={(e) => setRemaining(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          )}
        </fieldset>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={`¿Cuánto pagaste? (${currency})`} htmlFor="spool-price">
            <input
              id="spool-price"
              name="pricePaid"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Fecha de compra (opcional)" htmlFor="spool-date">
            <input id="spool-date" name="purchasedOn" type="date" className={inputClass} />
          </Field>
        </div>

        {totalGrams > 0 && priceNumber > 0 && (
          <p className="rounded-lg border border-ok/30 bg-ok-soft px-3 py-2 text-sm text-ink">
            Te cuesta <strong>{formatMoney(pricePerKg, currency)} por kilo</strong> (
            {pricePerGram < 1 ? pricePerGram.toFixed(2) : pricePerGram.toFixed(1)} por gramo). El cotizador usará este costo
            para {MATERIAL_LABEL[material as keyof typeof MATERIAL_LABEL] ?? material}.
          </p>
        )}

        <fieldset className="rounded-lg border border-line bg-raised/50 p-3 space-y-2.5">
          <legend className="px-1 text-sm font-medium text-ink">¿Cómo conseguiste esta bobina?</legend>
          {recordExpense && <input type="hidden" name="recordExpenseInMoney" value="on" />}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {([
              { value: "PURCHASED", title: "La compré ahora", hint: "Se anota como compra en Caja del mes." },
              { value: "OWNED", title: "Ya la tenía", hint: "No se anota en Caja del mes. Lo pagado solo sirve para calcular el costo de tus piezas." },
            ] as const).map((option) => {
              const selected = acquisition === option.value;
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-sm transition-colors ${
                    selected ? "border-primary bg-primary-soft/40" : "border-line bg-surface hover:bg-canvas"
                  }`}
                >
                  <input
                    type="radio"
                    name="acquisition"
                    value={option.value}
                    required
                    checked={selected}
                    onChange={() => setAcquisition(option.value)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="block font-semibold text-ink">{option.title}</span>
                    <span className="block text-xs text-muted">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {recordExpense && (
            <div className="max-w-xs">
              <Field label="¿Cómo la pagaste?" htmlFor="spool-payment">
                <select id="spool-payment" name="paymentMethod" defaultValue="TRANSFER" className={inputClass}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </fieldset>

        <Field label="Notas (opcional)" htmlFor="spool-notes">
          <input id="spool-notes" name="notes" maxLength={500} placeholder="Lote, temperatura recomendada, etc." className={inputClass} />
        </Field>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {welcome ? (
            <Link href="/orders/new" className={secondaryBtn}>
              Lo agrego después
            </Link>
          ) : (
            <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>
              Cancelar
            </button>
          )}
          <button type="submit" disabled={isPending || totalGrams <= 0} className={primaryBtn}>
            {isPending ? "Guardando…" : welcome ? "Guardar y seguir" : "Guardar bobina"}
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
          <p className="text-[11px] text-muted">¿Imprimiste algo? Descuenta lo que usaste:</p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[20, 50, 100].map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-label={`Descontar ${g} gramos de esta bobina`}
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
                {showCustom ? "Cerrar" : "Otra cantidad"}
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

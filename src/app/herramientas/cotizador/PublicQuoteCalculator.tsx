"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CURRENCIES, CURRENCY_LABEL, currencyDecimals, formatMoney, type Currency } from "@/lib/money-format";
import { MARGIN_GUIDE, PRINTER_PRESETS, computePublicQuote } from "@/lib/public-quote";

const inputClass =
  "w-full min-h-11 rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35";

/** Campo numérico con etiqueta conectada y ayuda opcional. */
function NumberField({
  label,
  value,
  onChange,
  hint,
  suffix,
  step = "1",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  suffix?: string;
  step?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} ${suffix ? "pr-14" : ""}`}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Section({ step, title, description, children }: { step: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">{step}</p>
      <h2 className="mt-1 font-display text-lg font-bold text-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{description}</p>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-line-strong"}`}
    >
      <span aria-hidden="true" className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

const toNumber = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Cotizador público de Kalibre: sin cuenta ni base de datos. La persona escribe todos sus datos y ve el costo
 * real de la pieza y el precio sugerido. Todo se calcula en el navegador con las mismas reglas del taller.
 */
export function PublicQuoteCalculator() {
  const [currency, setCurrency] = useState<Currency>("CLP");
  // 1. Costos fijos
  const [filamentPerKg, setFilamentPerKg] = useState("15000");
  const [kwhPrice, setKwhPrice] = useState("");
  const [printerPreset, setPrinterPreset] = useState("");
  const [watts, setWatts] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [spareParts, setSpareParts] = useState("");
  const [lifeHours, setLifeHours] = useState("");
  const [failure, setFailure] = useState("");
  // 2. La pieza
  const [grams, setGrams] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [colors, setColors] = useState(1);
  const [purge, setPurge] = useState("15");
  const [supplies, setSupplies] = useState("");
  const [packaging, setPackaging] = useState("");
  // 3. Cómo vendes
  const [margin, setMargin] = useState("60");
  const [useVat, setUseVat] = useState(false);
  const [vat, setVat] = useState("19");
  const [extraCommission, setExtraCommission] = useState("");
  const [useMl, setUseMl] = useState(false);
  const [mlCommission, setMlCommission] = useState("19");
  const [mlShipping, setMlShipping] = useState("");

  // Los montos se escriben en unidades normales y se calculan en la unidad mínima de la moneda.
  const factor = 10 ** currencyDecimals(currency);
  const money = (value: string) => Math.round(toNumber(value) * factor);

  const result = computePublicQuote({
    filamentPricePerKg: money(filamentPerKg),
    grams: toNumber(grams),
    colorsCount: colors,
    purgeGrams: toNumber(purge),
    printMinutes: toNumber(hours) * 60 + toNumber(minutes),
    kwhPrice: money(kwhPrice),
    printerWatts: toNumber(watts),
    sparePartsCost: showAdvanced ? money(spareParts) : 0,
    machineLifeHours: showAdvanced ? toNumber(lifeHours) : 0,
    failurePercent: showAdvanced ? toNumber(failure) : 0,
    suppliesCost: money(supplies),
    packagingCost: money(packaging),
    marginPercent: toNumber(margin),
    vatPercent: useVat ? toNumber(vat) : 0,
    extraCommissionPercent: toNumber(extraCommission),
    mlCommissionPercent: useMl ? toNumber(mlCommission) : 0,
    mlShippingCost: useMl ? money(mlShipping) : 0,
  });

  const fmt = (value: number) => formatMoney(value, currency);
  const hasPiece = toNumber(grams) > 0;
  const kwhLabel = new Intl.NumberFormat("es-CL", { maximumFractionDigits: result.kwh < 0.1 ? 3 : 2 }).format(result.kwh);

  const breakdown = [
    { label: `Filamento (${result.totalGrams} g)`, value: result.material, show: true },
    { label: `Luz (${kwhLabel} kWh)`, value: result.electricity, show: result.electricity > 0 },
    { label: "Desgaste de la máquina", value: result.wear, show: result.wear > 0 },
    { label: "Margen por fallas", value: result.failure, show: result.failure > 0 },
    { label: "Insumos", value: result.supplies, show: result.supplies > 0 },
    { label: "Embalaje", value: result.packaging, show: result.packaging > 0 },
  ].filter((row) => row.show);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start [&>*]:min-w-0">
      <div className="space-y-4">
        <Section step="Paso 1" title="Tus costos" description="Lo que pagas por el filamento y la luz. Escríbelos una vez y prueba distintas piezas.">
          <div>
            <label htmlFor="public-currency" className="mb-1.5 block text-sm font-medium text-ink">
              Moneda
            </label>
            <select id="public-currency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className={inputClass}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_LABEL[code]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Precio del filamento" suffix="por kg" value={filamentPerKg} onChange={setFilamentPerKg} hint="Lo que pagaste por un rollo de 1 kg." />
            <NumberField
              label="Precio del kWh"
              value={kwhPrice}
              onChange={setKwhPrice}
              placeholder="Ej: 200"
              hint="En tu boleta de luz: total a pagar ÷ kWh consumidos."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="public-printer" className="mb-1.5 block text-sm font-medium text-ink">
                Tu impresora
              </label>
              <select
                id="public-printer"
                value={printerPreset}
                onChange={(event) => {
                  setPrinterPreset(event.target.value);
                  const preset = PRINTER_PRESETS.find((item) => item.name === event.target.value);
                  if (preset) setWatts(String(preset.watts));
                }}
                className={inputClass}
              >
                <option value="">Elegir modelo (opcional)…</option>
                {PRINTER_PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} · ≈{preset.watts} W
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label="Consumo mientras imprime"
              suffix="W"
              value={watts}
              onChange={setWatts}
              placeholder="Ej: 100"
              hint="Promedio, no el máximo de la fuente. Si no lo sabes, 100 W es un buen punto de partida."
            />
          </div>

          <div className="rounded-xl border border-line bg-raised/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink">Desgaste y fallas (opcional)</p>
                <p className="text-xs text-muted">Repuestos que se gastan con el uso y las impresiones que salen mal.</p>
              </div>
              <Toggle label="Considerar desgaste y fallas" checked={showAdvanced} onChange={setShowAdvanced} />
            </div>
            {showAdvanced && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <NumberField label="Repuestos" value={spareParts} onChange={setSpareParts} placeholder="Ej: 150000" hint="Boquillas, cama, correas…" />
                <NumberField label="Vida útil" suffix="horas" value={lifeHours} onChange={setLifeHours} placeholder="Ej: 3000" hint="Horas hasta cambiarlos." />
                <NumberField label="Fallas" suffix="%" value={failure} onChange={setFailure} placeholder="Ej: 10" hint="De cada 10 piezas, ¿cuántas fallan?" />
              </div>
            )}
          </div>
        </Section>

        <Section step="Paso 2" title="La pieza" description="Los datos que te da tu laminador (Bambu Studio, OrcaSlicer, Cura, PrusaSlicer).">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField label="Peso" suffix="g" value={grams} onChange={setGrams} placeholder="Ej: 50" />
            <NumberField label="Tiempo" suffix="horas" value={hours} onChange={setHours} placeholder="Ej: 1" />
            <NumberField label="Y minutos" suffix="min" value={minutes} onChange={setMinutes} placeholder="Ej: 45" />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Colores</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={colors === count}
                  onClick={() => setColors(count)}
                  className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${
                    colors === count ? "border-primary bg-primary font-semibold text-white" : "border-line bg-raised text-ink hover:bg-canvas"
                  }`}
                >
                  {count} {count === 1 ? "color" : "colores"}
                </button>
              ))}
            </div>
          </fieldset>
          {colors > 1 && (
            <NumberField label="Purga multicolor" suffix="g" value={purge} onChange={setPurge} hint="Lo que se bota en la torre de purga al cambiar de color. Tu laminador lo muestra." />
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Insumos (opcional)" value={supplies} onChange={setSupplies} placeholder="Ej: 500" hint="Argolla, imán, tag NFC… por pieza." />
            <NumberField label="Embalaje (opcional)" value={packaging} onChange={setPackaging} placeholder="Ej: 200" hint="Caja, bolsa o etiqueta por pieza." />
          </div>
        </Section>

        <Section step="Paso 3" title="Cómo vendes" description="Tu ganancia, el IVA y las comisiones que te cobran.">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Margen de ganancia</legend>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {MARGIN_GUIDE.map((option) => (
                <button
                  key={option.margin}
                  type="button"
                  aria-pressed={margin === String(option.margin)}
                  onClick={() => setMargin(String(option.margin))}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-xl border px-3 text-left text-sm transition-colors ${
                    margin === String(option.margin) ? "border-primary bg-primary-soft/40 text-ink" : "border-line bg-raised text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="text-xs text-muted">{option.label}</span>
                  <strong>{option.margin}%</strong>
                </button>
              ))}
            </div>
            <div className="mt-2 max-w-[10rem]">
              <NumberField label="U otro margen" suffix="%" value={margin} onChange={setMargin} />
            </div>
            <p className="mt-1 text-xs text-muted">
              El margen es la parte del precio (sin IVA) que te queda limpia después de todos los costos.
            </p>
          </fieldset>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/50 p-3">
            <div>
              <p className="text-sm font-semibold text-ink">¿Tus precios incluyen IVA?</p>
              <p className="text-xs text-muted">Se separa del precio para que no cuentes como ganancia lo que pagas de impuesto.</p>
            </div>
            <Toggle label="Mis precios incluyen IVA" checked={useVat} onChange={setUseVat} />
          </div>
          {useVat && <NumberField label="IVA" suffix="%" value={vat} onChange={setVat} hint="En Chile es 19%." />}

          <NumberField
            label="Comisión por cobrar (opcional)"
            suffix="%"
            value={extraCommission}
            onChange={setExtraCommission}
            placeholder="Ej: 3"
            hint="Mercado Pago, máquina de tarjetas o pasarela de pago."
          />

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised/50 p-3">
            <div>
              <p className="text-sm font-semibold text-ink">¿Vendes por Mercado Libre?</p>
              <p className="text-xs text-muted">Te sugerimos el precio para publicar y ganar lo mismo que en venta directa.</p>
            </div>
            <Toggle label="Vendo por Mercado Libre" checked={useMl} onChange={setUseMl} />
          </div>
          {useMl && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberField label="Comisión de Mercado Libre" suffix="%" value={mlCommission} onChange={setMlCommission} />
              <NumberField label="Envío a tu cargo" value={mlShipping} onChange={setMlShipping} placeholder="Ej: 799" hint="Si ofreces envío gratis." />
            </div>
          )}
        </Section>
      </div>

      <aside id="resultado" aria-live="polite" className="scroll-mt-20 space-y-3 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-primary/40 bg-surface p-4 shadow-sm sm:p-5">
          <h2 className="font-display text-lg font-bold text-ink">Resultado</h2>
          {!hasPiece ? (
            <p className="mt-2 text-sm text-muted">Escribe el peso de la pieza en el paso 2 para ver su costo y su precio.</p>
          ) : (
            <>
              <dl className="mt-3 space-y-1.5 text-sm">
                {breakdown.map((row) => (
                  <div key={row.label} className="flex justify-between gap-2 text-muted">
                    <dt>{row.label}</dt>
                    <dd className="tabular-nums text-ink">{fmt(row.value)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-2 border-t border-line pt-2 font-semibold text-ink">
                  <dt>Te cuesta hacerla</dt>
                  <dd className="tabular-nums">{fmt(result.totalCost)}</dd>
                </div>
              </dl>

              <div className="mt-4 rounded-xl bg-ok-soft p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ok">Cobra en venta directa</p>
                <p className="mt-1 text-3xl font-bold text-ink tabular-nums">{fmt(result.directPrice)}</p>
                <p className="mt-1 text-sm text-ink">
                  Te quedan <strong className="text-ok">{fmt(result.profit)}</strong> limpios ({result.marginPercent}%).
                </p>
                {(result.directVat > 0 || result.directCommission > 0) && (
                  <p className="mt-0.5 text-xs text-muted">
                    {result.directVat > 0 && <>Incluye IVA {fmt(result.directVat)}</>}
                    {result.directVat > 0 && result.directCommission > 0 && " · "}
                    {result.directCommission > 0 && <>Comisión {fmt(result.directCommission)}</>}
                  </p>
                )}
              </div>

              {result.mlPrice !== null && (
                <div className="mt-3 rounded-xl bg-warn-soft p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-warn">Publica en Mercado Libre</p>
                  <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{fmt(result.mlPrice)}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Después de la comisión y el envío te deja lo mismo que la venta directa
                    {result.mlVat > 0 ? ` (incluye IVA ${fmt(result.mlVat)})` : ""}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="font-semibold text-ink">¿Cansado de escribir todo cada vez?</p>
          <p className="mt-1 text-muted">
            En Kalibre tus costos quedan guardados, el cotizador usa lo que de verdad pagaste por tus bobinas y cada venta
            queda registrada con su ganancia.
          </p>
          <Link
            href="/registro"
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Crear mi taller gratis →
          </Link>
        </div>
      </aside>

      {/* En el celular el resultado queda al final: esta barra lo muestra mientras se escribe. */}
      {hasPiece && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted">Cobra · te cuesta {fmt(result.totalCost)}</p>
              <p className="text-xl font-bold text-ink tabular-nums">{fmt(result.directPrice)}</p>
            </div>
            <a href="#resultado" className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
              Ver detalle
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { startTransition, useActionState, useId, useMemo, useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
import { electricityCostPerHourFromKwh } from "@/lib/costing";
import { CURRENCIES, CURRENCY_LABEL, formatMoney, type Currency } from "@/lib/money-format";
import type { CenterSettingsView } from "@/lib/center-settings-service";
import { saveCenterSettingsAction } from "./actions";

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:opacity-60";

type State = { error?: string; message?: string };

/** Consumo promedio aproximado mientras imprime (la cama caliente es lo que más consume). */
const PRINTER_WATT_PRESETS = [
  { label: "Pequeña sin cama caliente", watts: 60 },
  { label: "Escritorio con cama caliente", watts: 150 },
  { label: "Multicolor o cama grande", watts: 250 },
  { label: "Gran formato", watts: 400 },
] as const;

const MARGIN_PRESETS = [40, 50, 60, 70] as const;

function Feedback({ state }: { state: State }) {
  if (state.error)
    return (
      <p role="alert" data-testid="settings-error" className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" data-testid="settings-message" className="rounded-lg border border-ok/20 bg-ok-soft px-3 py-2 text-sm text-ok">
        {state.message}
      </p>
    );
  return null;
}

/** Ayuda desplegable con bombilla: explica qué es un dato y cómo encontrarlo. */
function HelpTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-xl border border-accent/30 bg-accent-soft/30 text-sm">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 font-medium text-ink">
        <span aria-hidden="true">💡</span>
        <span>{title}</span>
        <span aria-hidden="true" className="ml-auto text-muted transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2 px-3 pb-3 text-muted">{children}</div>
    </details>
  );
}

/** Pregunta "¿Quieres considerar…?" con interruptor Sí/No; al activarla se muestran sus campos. */
function CostToggle({
  title,
  description,
  enabled,
  onChange,
  children,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 id={`${id}-title`} className="font-semibold text-ink">
            {title}
          </h3>
          <p id={`${id}-description`} className="mt-0.5 text-sm text-muted">
            {description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          aria-describedby={`${id}-description`}
          onClick={() => onChange(!enabled)}
          className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-line-strong"
          }`}
        >
          <span className="sr-only">{enabled ? "Sí" : "No"}</span>
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>
      {enabled && <div className="mt-4">{children}</div>}
    </Card>
  );
}

export function SettingsForm({ settings, welcome = false }: { settings: CenterSettingsView; welcome?: boolean }) {
  const [state, run, pending] = useActionState(saveCenterSettingsAction, {});

  const [currency, setCurrency] = useState<Currency>(settings.currency);
  const [timeZone, setTimeZone] = useState(settings.timeZone);

  // Luz: precio del kWh × consumo de la impresora; el costo por hora se puede ajustar a mano.
  const [useElectricity, setUseElectricity] = useState(settings.electricityCostPerHour > 0 || settings.electricityKwhPrice > 0);
  const [kwhPrice, setKwhPrice] = useState(settings.electricityKwhPrice ? String(settings.electricityKwhPrice) : "");
  const [printerWatts, setPrinterWatts] = useState(settings.printerWatts ? String(settings.printerWatts) : "");
  const [electricityCost, setElectricityCost] = useState(String(settings.electricityCostPerHour));

  const [useMercadoLibre, setUseMercadoLibre] = useState(settings.mlCommissionPercent > 0 || settings.mlDefaultShippingCost > 0);
  const [mlCommission, setMlCommission] = useState(String(settings.mlCommissionPercent || 19));
  const [mlShipping, setMlShipping] = useState(String(settings.mlDefaultShippingCost));

  const [useExtraCommission, setUseExtraCommission] = useState(settings.extraCommissionPercent > 0);
  const [extraCommission, setExtraCommission] = useState(settings.extraCommissionPercent ? String(settings.extraCommissionPercent) : "");

  const [useVat, setUseVat] = useState(settings.vatPercent > 0);
  const [vatPercent, setVatPercent] = useState(String(settings.vatPercent || 19));

  const [usePackaging, setUsePackaging] = useState(settings.defaultPackagingCost > 0);
  const [packaging, setPackaging] = useState(String(settings.defaultPackagingCost));

  const [marginPercent, setMarginPercent] = useState(String(settings.defaultMarginPercent));

  const [costPerKg, setCostPerKg] = useState(String(settings.defaultCostPerKg));
  const [purgeGrams, setPurgeGrams] = useState(String(settings.defaultPurgeGrams));
  const [lowSpoolThreshold, setLowSpoolThreshold] = useState(String(settings.lowSpoolThresholdGrams));

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [] as string[];
    }
  }, []);

  const computedPerHour = electricityCostPerHourFromKwh(Number(kwhPrice) || 0, Number(printerWatts) || 0);
  const perHourShown = computedPerHour > 0 ? String(computedPerHour) : electricityCost;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set("currency", currency);
    data.set("timeZone", timeZone);
    // Un costo desactivado se guarda en 0: no se considera en el cotizador.
    data.set("electricityKwhPrice", useElectricity ? kwhPrice || "0" : "0");
    data.set("printerWatts", useElectricity ? printerWatts || "0" : "0");
    data.set("electricityCostPerHour", useElectricity ? perHourShown || "0" : "0");
    data.set("mlCommissionPercent", useMercadoLibre ? mlCommission || "0" : "0");
    data.set("mlDefaultShippingCost", useMercadoLibre ? mlShipping || "0" : "0");
    data.set("extraCommissionPercent", useExtraCommission ? extraCommission || "0" : "0");
    data.set("vatPercent", useVat ? vatPercent || "0" : "0");
    data.set("defaultPackagingCost", usePackaging ? packaging || "0" : "0");
    data.set("defaultMarginPercent", marginPercent || "0");
    data.set("defaultCostPerKg", costPerKg);
    data.set("defaultPurgeGrams", purgeGrams);
    data.set("lowSpoolThresholdGrams", lowSpoolThreshold);
    if (welcome) data.set("welcome", "1");
    startTransition(() => run(data));
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {welcome && (
        <Card className="border-primary/40 bg-primary-soft/30 p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold text-ink">Primero, tus costos</h2>
          <p className="mt-1 text-sm text-muted">
            Cada venta tiene costos detrás. Activa solo los que quieras considerar; todo es opcional y puedes
            cambiarlo cuando quieras. Así el cotizador te muestra tu ganancia real desde la primera venta.
          </p>
        </Card>
      )}

      <CostToggle
        title="¿Quieres considerar la luz?"
        description="Lo que gasta tu impresora en electricidad por cada hora de impresión."
        enabled={useElectricity}
        onChange={setUseElectricity}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Precio del kWh (${currency})`} htmlFor="settings-kwh-price" hint="Cuánto te cobran por cada kilowatt hora.">
            <input
              id="settings-kwh-price"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="Ej: 200"
              value={kwhPrice}
              onChange={(e) => setKwhPrice(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Consumo de tu impresora (W)" htmlFor="settings-printer-watts" hint="Promedio mientras imprime.">
            <input
              id="settings-printer-watts"
              type="number"
              inputMode="numeric"
              min="0"
              step="10"
              placeholder="Ej: 150"
              value={printerWatts}
              onChange={(e) => setPrinterWatts(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Consumos típicos">
          {PRINTER_WATT_PRESETS.map((preset) => (
            <button
              key={preset.watts}
              type="button"
              onClick={() => setPrinterWatts(String(preset.watts))}
              className={`min-h-9 rounded-full border px-3 text-xs transition-colors ${
                printerWatts === String(preset.watts) ? "border-primary bg-primary text-white" : "border-line bg-raised text-ink hover:bg-canvas"
              }`}
            >
              {preset.label} · {preset.watts} W
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-raised p-3">
          <Field
            label={`Costo de luz por hora (${currency})`}
            htmlFor="settings-electricity"
            hint={
              computedPerHour > 0
                ? `Calculado: ${formatMoney(Number(kwhPrice), currency)} × ${printerWatts} W ÷ 1.000 = ${formatMoney(computedPerHour, currency)} por hora.`
                : "Completa el kWh y los watts para calcularlo, o escríbelo directo."
            }
          >
            <input
              id="settings-electricity"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={perHourShown}
              readOnly={computedPerHour > 0}
              onChange={(e) => setElectricityCost(e.target.value)}
              className={`${inputClass} ${computedPerHour > 0 ? "opacity-80" : ""}`}
            />
          </Field>
        </div>

        <HelpTip title="¿Cómo sé cuánto vale mi kWh?">
          <p>
            Mira tu boleta de luz: busca el cargo por <strong className="text-ink">energía</strong> expresado en $/kWh. Si no
            aparece, divide el <strong className="text-ink">total a pagar</strong> por los <strong className="text-ink">kWh
            consumidos</strong> del mes; eso te da un precio promedio que ya incluye cargos fijos.
          </p>
        </HelpTip>
        <HelpTip title="¿Cuántos watts consume mi impresora?">
          <p>
            La etiqueta de la fuente dice el máximo (por ejemplo 350 W), pero mientras imprime consume bastante menos: la
            cama caliente gasta mucho al calentar y después solo mantiene la temperatura.
          </p>
          <p>
            Si tienes un enchufe medidor, déjalo una impresión completa y usa ese promedio. Si no, elige uno de los
            consumos típicos de arriba; siempre puedes ajustarlo después.
          </p>
        </HelpTip>
      </CostToggle>

      <CostToggle
        title="¿Vendes por Mercado Libre?"
        description="Para calcular cuánto te llega de verdad después de la comisión y el envío."
        enabled={useMercadoLibre}
        onChange={setUseMercadoLibre}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Comisión de Mercado Libre (%)" htmlFor="settings-ml-commission" hint="La que te cobran por venta.">
            <input
              id="settings-ml-commission"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={mlCommission}
              onChange={(e) => setMlCommission(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`Envío a tu cargo (${currency})`} htmlFor="settings-ml-shipping" hint="Si ofreces envío gratis, lo que te descuentan.">
            <input
              id="settings-ml-shipping"
              type="number"
              min="0"
              step="1"
              value={mlShipping}
              onChange={(e) => setMlShipping(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <HelpTip title="¿Dónde veo mi comisión y envío?">
          <p>
            En el detalle de una venta en Mercado Libre aparece el <strong className="text-ink">cargo por venta</strong> y
            el <strong className="text-ink">costo de envío</strong>. Usa los de una venta típica; en cada venta puedes
            corregirlos.
          </p>
        </HelpTip>
      </CostToggle>

      <CostToggle
        title="¿Pagas otra comisión por venta?"
        description="Por ejemplo Mercado Pago, una pasarela de pago o la máquina de tarjetas."
        enabled={useExtraCommission}
        onChange={setUseExtraCommission}
      >
        <Field label="Comisión adicional (%)" htmlFor="settings-extra-commission" hint="Se descuenta de las ventas directas en el cotizador.">
          <input
            id="settings-extra-commission"
            type="number"
            step="0.01"
            min="0"
            max="50"
            placeholder="Ej: 3,19"
            value={extraCommission}
            onChange={(e) => setExtraCommission(e.target.value)}
            className={inputClass}
          />
        </Field>
      </CostToggle>

      <CostToggle
        title="¿Tus precios incluyen IVA?"
        description="Para que la ganancia no cuente el IVA que después pagas."
        enabled={useVat}
        onChange={setUseVat}
      >
        <Field label="IVA (%)" htmlFor="settings-vat" hint="En Chile es 19%.">
          <input
            id="settings-vat"
            type="number"
            step="0.01"
            min="0"
            max="50"
            value={vatPercent}
            onChange={(e) => setVatPercent(e.target.value)}
            className={inputClass}
          />
        </Field>
        <HelpTip title="¿Qué hace Kalibre con el IVA?">
          <p>
            Solo lo usa para calcular: de cada precio separa la parte que es IVA y te muestra la ganancia sin él. No emite
            boletas ni se conecta con el SII.
          </p>
        </HelpTip>
      </CostToggle>

      <CostToggle
        title="¿Quieres considerar el embalaje?"
        description="Caja, bolsa, etiqueta o protección de cada pieza."
        enabled={usePackaging}
        onChange={setUsePackaging}
      >
        <Field label={`Embalaje por pieza (${currency})`} htmlFor="settings-packaging" hint="Si las cajas te salen gratis, déjalo apagado.">
          <input
            id="settings-packaging"
            type="number"
            min="0"
            step="1"
            value={packaging}
            onChange={(e) => setPackaging(e.target.value)}
            className={inputClass}
          />
        </Field>
      </CostToggle>

      <Card className="p-4 sm:p-5">
        <h3 className="font-semibold text-ink">Tu margen mínimo de ganancia</h3>
        <p className="mt-0.5 text-sm text-muted">
          El cotizador te sugiere precios con este margen. En cada cotización lo puedes cambiar.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {MARGIN_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={marginPercent === String(value)}
              onClick={() => setMarginPercent(String(value))}
              className={`min-h-10 rounded-xl border px-4 text-sm transition-colors ${
                marginPercent === String(value) ? "border-primary bg-primary text-white font-semibold" : "border-line bg-raised text-ink hover:bg-canvas"
              }`}
            >
              {value}%
            </button>
          ))}
          <label htmlFor="settings-margin" className="sr-only">
            Margen mínimo (%)
          </label>
          <input
            id="settings-margin"
            type="number"
            min="0"
            max="95"
            step="1"
            value={marginPercent}
            onChange={(e) => setMarginPercent(e.target.value)}
            className={`${inputClass} w-24`}
          />
          <span className="text-sm text-muted">%</span>
        </div>
        <HelpTip title="¿Qué margen me conviene?">
          <p>
            El margen es la parte del precio (sin IVA) que te queda como ganancia después de todos los costos. Con 60%, una
            pieza que te cuesta $1.000 se sugiere en $2.500. Piezas únicas o personalizadas suelen aguantar más margen que
            las de catálogo con mucha competencia.
          </p>
        </HelpTip>
      </Card>

      <details className="group rounded-2xl border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-semibold text-ink sm:px-5">
          Moneda, zona horaria y filamento
          <span aria-hidden="true" className="ml-auto text-muted transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="grid grid-cols-1 gap-4 px-4 pb-5 sm:grid-cols-2 sm:px-5">
          <Field
            label="Moneda del taller"
            htmlFor="settings-currency"
            hint={
              settings.currencyLocked
                ? "La moneda no se puede cambiar porque el taller ya registra movimientos de dinero."
                : "Moneda de cobro y registro."
            }
          >
            <select
              id="settings-currency"
              value={currency}
              disabled={settings.currencyLocked}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className={`${inputClass} ${settings.currencyLocked ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_LABEL[code]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Zona horaria" htmlFor="settings-timezone" hint="Define la fecha de tus pedidos, cobros y cierres del mes.">
            <input
              id="settings-timezone"
              list="center-zones-list"
              value={timeZone}
              onChange={(e) => setTimeZone(e.target.value)}
              className={inputClass}
            />
            <datalist id="center-zones-list">
              {zones.map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </Field>

          <Field
            label={`Costo de filamento por defecto (${currency}/kg)`}
            htmlFor="settings-cost-per-kg"
            hint="Se usa mientras no tengas bobinas cargadas de ese material."
          >
            <input
              id="settings-cost-per-kg"
              type="number"
              min="0"
              step="1"
              value={costPerKg}
              onChange={(e) => setCostPerKg(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Purga multicolor por defecto (g)" htmlFor="settings-purge" hint="Gramos que se botan en la torre de purga al imprimir en varios colores.">
            <input
              id="settings-purge"
              type="number"
              min="0"
              step="1"
              value={purgeGrams}
              onChange={(e) => setPurgeGrams(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Aviso de bobina baja (g)" htmlFor="settings-low-spool" hint="Te avisamos cuando a una bobina le quede menos que esto.">
            <input
              id="settings-low-spool"
              type="number"
              min="0"
              step="1"
              value={lowSpoolThreshold}
              onChange={(e) => setLowSpoolThreshold(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      <Feedback state={state} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        {welcome && (
          <Link href="/dashboard" className="min-h-11 px-3 text-sm font-semibold text-muted hover:text-ink inline-flex items-center">
            Lo configuro después
          </Link>
        )}
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Guardando ajustes…" : welcome ? "Guardar y seguir" : "Guardar ajustes"}
        </button>
      </div>
    </form>
  );
}

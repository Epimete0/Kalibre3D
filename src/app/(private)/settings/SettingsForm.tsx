"use client";

import Link from "next/link";
import { startTransition, useActionState, useId, useMemo, useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
import { SmartMoneyInput } from "@/components/SmartMoneyInput";
import { electricityCostPerHourFromKwh, machineWearCostPerHourFromReplacement } from "@/lib/costing";
import { CURRENCIES, CURRENCY_LABEL, formatMoney, type Currency } from "@/lib/money-format";
import type { CenterSettingsView } from "@/lib/center-settings-service";
import { saveCenterSettingsAction } from "./actions";

const primary =
  "inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:opacity-60";

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

/** Ayuda desplegable: explica qué es un dato y cómo encontrarlo. */
function HelpTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-xl border border-accent/30 bg-accent-soft/30 text-sm">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 font-medium text-ink">
        <svg
          className="h-4 w-4 shrink-0 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
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

  // Desgaste de impresora (opcional): costo de reposición ÷ vida útil en horas, o valor directo por hora.
  const [useWear, setUseWear] = useState(settings.machineWearCostPerHour > 0 || settings.machineReplacementCost > 0);
  const [machineReplacement, setMachineReplacement] = useState(
    settings.machineReplacementCost ? String(settings.machineReplacementCost) : "",
  );
  const [machineLifeHours, setMachineLifeHours] = useState(
    settings.machineLifeHours ? String(settings.machineLifeHours) : "",
  );
  const [wearCostPerHour, setWearCostPerHour] = useState(String(settings.machineWearCostPerHour));

  // Margen por piezas fallidas o reimpresiones (opcional).
  const [useFailure, setUseFailure] = useState(settings.failurePercent > 0);
  const [failurePercent, setFailurePercent] = useState(String(settings.failurePercent || 5));

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

  // Módulos opcionales del taller (las 3 preguntas)
  const [enableSpools, setEnableSpools] = useState(settings.enableSpools ?? true);
  const [enableProductStock, setEnableProductStock] = useState(settings.enableProductStock ?? true);
  const [enableClients, setEnableClients] = useState(settings.enableClients ?? true);

  const isSimplePreset = !enableSpools && !enableProductStock && !enableClients;
  const isFullPreset = enableSpools && enableProductStock && enableClients;

  const applySimplePreset = () => {
    setEnableSpools(false);
    setEnableProductStock(false);
    setEnableClients(false);
  };

  const applyFullPreset = () => {
    setEnableSpools(true);
    setEnableProductStock(true);
    setEnableClients(true);
  };

  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [] as string[];
    }
  }, []);

  const computedPerHour = electricityCostPerHourFromKwh(Number(kwhPrice) || 0, Number(printerWatts) || 0);
  const perHourShown = computedPerHour > 0 ? String(computedPerHour) : electricityCost;

  const computedWearPerHour = machineWearCostPerHourFromReplacement(
    Number(machineReplacement) || 0,
    Number(machineLifeHours) || 0,
  );
  const wearPerHourShown = computedWearPerHour > 0 ? String(computedWearPerHour) : wearCostPerHour;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set("currency", currency);
    data.set("timeZone", timeZone);
    // Un costo desactivado se guarda en 0: no se considera en el cotizador.
    data.set("electricityKwhPrice", useElectricity ? kwhPrice || "0" : "0");
    data.set("printerWatts", useElectricity ? printerWatts || "0" : "0");
    data.set("electricityCostPerHour", useElectricity ? perHourShown || "0" : "0");
    data.set("machineReplacementCost", useWear ? machineReplacement || "0" : "0");
    data.set("machineLifeHours", useWear ? machineLifeHours || "0" : "0");
    data.set("machineWearCostPerHour", useWear ? wearPerHourShown || "0" : "0");
    data.set("failurePercent", useFailure ? failurePercent || "0" : "0");
    data.set("mlCommissionPercent", useMercadoLibre ? mlCommission || "0" : "0");
    data.set("mlDefaultShippingCost", useMercadoLibre ? mlShipping || "0" : "0");
    data.set("extraCommissionPercent", useExtraCommission ? extraCommission || "0" : "0");
    data.set("vatPercent", useVat ? vatPercent || "0" : "0");
    data.set("defaultPackagingCost", usePackaging ? packaging || "0" : "0");
    data.set("defaultMarginPercent", marginPercent || "0");
    data.set("defaultCostPerKg", costPerKg);
    data.set("defaultPurgeGrams", purgeGrams);
    data.set("lowSpoolThresholdGrams", lowSpoolThreshold);
    data.set("enableSpools", enableSpools ? "true" : "false");
    data.set("enableProductStock", enableProductStock ? "true" : "false");
    data.set("enableClients", enableClients ? "true" : "false");
    if (welcome) data.set("welcome", "1");
    startTransition(() => run(data));
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <Card className="border-primary/35 bg-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-ink">
              Personaliza tu taller
            </span>
            <h2 className="mt-1 font-display text-lg font-bold text-ink">
              ¿Qué módulos necesitas usar?
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-muted">
              El núcleo de Kalibre (<strong>Cotizador</strong>, <strong>Ventas</strong> y <strong>Dinero</strong>) siempre está activo. Responde estas 3 preguntas para ocultar lo que no uses hoy; puedes activarlo cuando quieras.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <button
              type="button"
              onClick={applySimplePreset}
              aria-pressed={isSimplePreset}
              className={`min-h-9 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                isSimplePreset
                  ? "border-ink bg-ink text-surface shadow-xs"
                  : "border-line bg-raised text-ink hover:bg-canvas"
              }`}
            >
              Modo simple (solo costos y plata)
            </button>
            <button
              type="button"
              onClick={applyFullPreset}
              aria-pressed={isFullPreset}
              className={`min-h-9 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                isFullPreset
                  ? "border-ink bg-ink text-surface shadow-xs"
                  : "border-line bg-raised text-ink hover:bg-canvas"
              }`}
            >
              Modo completo (todo activo)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-line/70 pt-3">
          {/* Pregunta 1: Filamento */}
          <div className="rounded-xl border border-line bg-raised/40 p-3.5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">1. ¿Cómo prefieres controlar el filamento?</p>
                <p className="text-xs text-muted">
                  Si pesas tus carretes aparte o solo te importa cuánto te cuesta el kilo, elige el modo simple.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 text-xs shrink-0">
                <button
                  type="button"
                  aria-pressed={!enableSpools}
                  onClick={() => setEnableSpools(false)}
                  className={`min-h-8 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                    !enableSpools ? "bg-ink text-surface" : "text-muted hover:text-ink"
                  }`}
                >
                  Solo precio por kg
                </button>
                <button
                  type="button"
                  aria-pressed={enableSpools}
                  onClick={() => setEnableSpools(true)}
                  className={`min-h-8 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                    enableSpools ? "bg-ink text-surface" : "text-muted hover:text-ink"
                  }`}
                >
                  Inventario de bobinas
                </button>
              </div>
            </div>
            {!enableSpools && (
              <div className="max-w-xs pt-1">
                <Field
                  label={`¿Cuánto te cuesta el kilo de filamento en promedio? (${currency}/kg)`}
                  htmlFor="settings-simple-cost-per-kg"
                  hint="El cotizador y tus ventas usarán este valor directo."
                >
                  <SmartMoneyInput
                    id="settings-simple-cost-per-kg"
                    currency={currency}
                    integerOnly
                    allowZeroDisplay
                    value={costPerKg}
                    onChangeValue={setCostPerKg}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Pregunta 2: Stock de piezas */}
          <div className="rounded-xl border border-line bg-raised/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">2. ¿Guardas stock de piezas ya impresas para entrega inmediata?</p>
              <p className="text-xs text-muted">
                Si imprimes a pedido, desactívalo para que el catálogo sea solo tu lista de precios y recetas sin avisos de stock.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 text-xs shrink-0">
              <button
                type="button"
                aria-pressed={!enableProductStock}
                onClick={() => setEnableProductStock(false)}
                className={`min-h-8 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  !enableProductStock ? "bg-ink text-surface" : "text-muted hover:text-ink"
                }`}
              >
                Imprimo a pedido
              </button>
              <button
                type="button"
                aria-pressed={enableProductStock}
                onClick={() => setEnableProductStock(true)}
                className={`min-h-8 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  enableProductStock ? "bg-ink text-surface" : "text-muted hover:text-ink"
                }`}
              >
                Llevo stock listo
              </button>
            </div>
          </div>

          {/* Pregunta 3: Clientes */}
          <div className="rounded-xl border border-line bg-raised/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">3. ¿Quieres llevar una agenda de clientes (CRM)?</p>
              <p className="text-xs text-muted">
                Si solo quieres anotar ventas rápido sin guardar fichas de compradores, puedes ocultarla.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 text-xs shrink-0">
              <button
                type="button"
                aria-pressed={!enableClients}
                onClick={() => setEnableClients(false)}
                className={`min-h-8 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  !enableClients ? "bg-ink text-surface" : "text-muted hover:text-ink"
                }`}
              >
                Solo ventas rápidas
              </button>
              <button
                type="button"
                aria-pressed={enableClients}
                onClick={() => setEnableClients(true)}
                className={`min-h-8 rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                  enableClients ? "bg-ink text-surface" : "text-muted hover:text-ink"
                }`}
              >
                Agenda de clientes
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-2.5 pt-1">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Costos de fabricación (opcionales)
          </h2>
          <p className="text-xs text-muted">
            Activa solo los costos que quieras incluir al calcular cuánto te cuesta fabricar cada pieza.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
      <CostToggle
        title="¿Quieres considerar la luz?"
        description="Lo que gasta tu impresora en electricidad por cada hora de impresión."
        enabled={useElectricity}
        onChange={setUseElectricity}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`Precio del kWh (${currency})`} htmlFor="settings-kwh-price" hint="Cuánto te cobran por cada kilowatt hora.">
            <SmartMoneyInput
              id="settings-kwh-price"
              currency={currency}
              integerOnly
              placeholder="Ej: 200"
              value={kwhPrice}
              onChangeValue={setKwhPrice}
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
              className={`min-h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                printerWatts === String(preset.watts) ? "border-ink bg-ink text-surface font-semibold" : "border-line bg-raised text-ink hover:bg-canvas"
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
            <SmartMoneyInput
              id="settings-electricity"
              currency={currency}
              integerOnly
              allowZeroDisplay
              value={perHourShown}
              disabled={computedPerHour > 0}
              onChangeValue={setElectricityCost}
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
        title="¿Quieres considerar el desgaste de tu impresora?"
        description="Repuestos, boquillas y mantención repartidos por cada hora de impresión (opcional)."
        enabled={useWear}
        onChange={setUseWear}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={`Valor de tu impresora o repuestos (${currency})`}
            htmlFor="settings-wear-replacement"
            hint="Ej. lo que costó la máquina o un kit anual de mantención."
          >
            <SmartMoneyInput
              id="settings-wear-replacement"
              currency={currency}
              integerOnly
              placeholder="Ej: 450.000"
              value={machineReplacement}
              onChangeValue={setMachineReplacement}
            />
          </Field>
          <Field label="Vida útil estimada (horas)" htmlFor="settings-wear-life" hint="Ej. 3.000 a 5.000 h de impresión.">
            <input
              id="settings-wear-life"
              type="number"
              inputMode="numeric"
              min="0"
              step="100"
              placeholder="Ej: 4000"
              value={machineLifeHours}
              onChange={(e) => setMachineLifeHours(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Vidas útiles típicas">
          {[2000, 4000, 6000].map((hours) => (
            <button
              key={hours}
              type="button"
              onClick={() => setMachineLifeHours(String(hours))}
              className={`min-h-9 rounded-xl border px-3 text-xs font-medium transition-colors ${
                machineLifeHours === String(hours) ? "border-ink bg-ink text-surface font-semibold" : "border-line bg-raised text-ink hover:bg-canvas"
              }`}
            >
              {hours.toLocaleString("es-CL")} h
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-raised p-3">
          <Field
            label={`Desgaste por hora (${currency})`}
            htmlFor="settings-wear-per-hour"
            hint={
              computedWearPerHour > 0
                ? `Calculado: ${formatMoney(Number(machineReplacement), currency)} ÷ ${Number(machineLifeHours).toLocaleString("es-CL")} h = ${formatMoney(computedWearPerHour, currency)} por hora.`
                : "Completa el valor y las horas de arriba para calcularlo, o escribe un monto directo por hora."
            }
          >
            <SmartMoneyInput
              id="settings-wear-per-hour"
              currency={currency}
              integerOnly
              allowZeroDisplay
              value={wearPerHourShown}
              disabled={computedWearPerHour > 0}
              onChangeValue={setWearCostPerHour}
              className={`${inputClass} ${computedWearPerHour > 0 ? "opacity-80" : ""}`}
            />
          </Field>
        </div>
      </CostToggle>

      <CostToggle
        title="¿Quieres cubrir un porcentaje de fallos?"
        description="Respaldo opcional por si una impresión falla o requiere reimpresión."
        enabled={useFailure}
        onChange={setUseFailure}
      >
        <div className="flex flex-wrap items-center gap-2">
          {[3, 5, 10, 15].map((pct) => (
            <button
              key={pct}
              type="button"
              aria-pressed={failurePercent === String(pct)}
              onClick={() => setFailurePercent(String(pct))}
              className={`min-h-10 rounded-xl border px-3.5 text-sm transition-colors ${
                failurePercent === String(pct) ? "border-ink bg-ink text-surface font-semibold" : "border-line bg-raised text-ink hover:bg-canvas"
              }`}
            >
              {pct}%
            </button>
          ))}
          <label htmlFor="settings-failure-percent" className="sr-only">
            Porcentaje de fallos (%)
          </label>
          <input
            id="settings-failure-percent"
            type="number"
            min="0"
            max="50"
            step="0.5"
            value={failurePercent}
            onChange={(e) => setFailurePercent(e.target.value)}
            className={`${inputClass} w-24`}
          />
          <span className="text-sm text-muted">% sobre material, luz y desgaste</span>
        </div>
      </CostToggle>

      <CostToggle
        title="¿Quieres considerar el embalaje?"
        description="Caja, bolsa, etiqueta o protección de cada pieza."
        enabled={usePackaging}
        onChange={setUsePackaging}
      >
        <Field label={`Embalaje por pieza (${currency})`} htmlFor="settings-packaging" hint="Si las cajas te salen gratis, déjalo apagado.">
          <SmartMoneyInput
            id="settings-packaging"
            currency={currency}
            integerOnly
            allowZeroDisplay
            value={packaging}
            onChangeValue={setPackaging}
          />
        </Field>
      </CostToggle>
        </div>
      </div>

      <div className="space-y-2.5 pt-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
            Canales de venta, impuestos y margen
          </h2>
          <p className="text-xs text-muted">
            Para saber cuánto te queda limpio después de comisiones, envíos e IVA.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
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
            <SmartMoneyInput
              id="settings-ml-shipping"
              currency={currency}
              integerOnly
              allowZeroDisplay
              value={mlShipping}
              onChangeValue={setMlShipping}
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
                marginPercent === String(value) ? "border-ink bg-ink text-surface font-semibold" : "border-line bg-raised text-ink hover:bg-canvas"
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
        </div>
      </div>

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
            <SmartMoneyInput
              id="settings-cost-per-kg"
              currency={currency}
              integerOnly
              allowZeroDisplay
              value={costPerKg}
              onChangeValue={setCostPerKg}
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

      <div className="sticky bottom-20 lg:bottom-4 z-10 rounded-2xl border border-line-strong bg-surface/95 px-4 py-3 shadow-[0_8px_24px_rgba(28,29,33,0.12)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          {state.error || state.message ? (
            <Feedback state={state} />
          ) : (
            <p className="text-xs sm:text-sm text-muted">
              Modo activo:{" "}
              <strong className="text-ink font-semibold">
                {isSimplePreset
                  ? "Simple (solo costos y plata)"
                  : isFullPreset
                    ? "Completo (todos los módulos)"
                    : "Personalizado"}
              </strong>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
          {welcome && (
            <Link href="/dashboard" className="min-h-10 px-3 text-xs sm:text-sm font-semibold text-muted hover:text-ink inline-flex items-center">
              Lo configuro después
            </Link>
          )}
          <button type="submit" disabled={pending} className={primary}>
            {pending ? "Guardando ajustes…" : welcome ? "Guardar y seguir" : "Guardar ajustes"}
          </button>
        </div>
      </div>
    </form>
  );
}

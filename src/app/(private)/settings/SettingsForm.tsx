"use client";

import { startTransition, useActionState, useMemo, useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
import { CURRENCIES, CURRENCY_LABEL, type Currency } from "@/lib/money-format";
import type { CenterSettingsView } from "@/lib/center-settings-service";
import { saveCenterSettingsAction } from "./actions";

const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 disabled:opacity-60";

type State = { error?: string; message?: string };

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

export function SettingsForm({ settings }: { settings: CenterSettingsView }) {
  const [state, run, pending] = useActionState(saveCenterSettingsAction, {});

  const [currency, setCurrency] = useState<Currency>(settings.currency);
  const [timeZone, setTimeZone] = useState(settings.timeZone);
  const [electricityCost, setElectricityCost] = useState(String(settings.electricityCostPerHour));
  const [mlCommission, setMlCommission] = useState(String(settings.mlCommissionPercent));
  const [mlShipping, setMlShipping] = useState(String(settings.mlDefaultShippingCost));
  const [packaging, setPackaging] = useState(String(settings.defaultPackagingCost));
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

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData();
    data.set("currency", currency);
    data.set("timeZone", timeZone);
    data.set("electricityCostPerHour", electricityCost);
    data.set("mlCommissionPercent", mlCommission);
    data.set("mlDefaultShippingCost", mlShipping);
    data.set("defaultPackagingCost", packaging);
    data.set("defaultCostPerKg", costPerKg);
    data.set("defaultPurgeGrams", purgeGrams);
    data.set("lowSpoolThresholdGrams", lowSpoolThreshold);
    startTransition(() => run(data));
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <Card className="p-6">
        <h2 className="font-display text-xl text-ink">Moneda y Región</h2>
        <p className="mt-1 text-sm text-muted">
          Define la moneda con que opera el taller y la zona horaria para los registros diarios y resúmenes.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <Field
            label="Zona horaria"
            htmlFor="settings-timezone"
            hint="Determina la fecha local de tus pedidos, cobros y cierres mensuales."
          >
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
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl text-ink">Ventas por Mercado Libre</h2>
        <p className="mt-1 text-sm text-muted">
          Valores sugeridos al activar la casilla de Mercado Libre en una venta para calcular el monto neto real.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Comisión de Mercado Libre (%)"
            htmlFor="settings-ml-commission"
            hint="Porcentaje habitual de comisión (por defecto 19%)."
          >
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

          <Field
            label="Envío a cargo del vendedor por defecto"
            htmlFor="settings-ml-shipping"
            hint="Costo de envío que descuenta Mercado Libre si el envío gratis va a tu cargo."
          >
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
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-xl text-ink">Costos del Taller y Fabricación</h2>
        <p className="mt-1 text-sm text-muted">
          Parámetros para calcular el costo real de impresión, consumo eléctrico y embalaje.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Costo de luz por hora"
            htmlFor="settings-electricity"
            hint="Gasto eléctrico estimado por cada hora de impresión."
          >
            <input
              id="settings-electricity"
              type="number"
              min="0"
              step="1"
              value={electricityCost}
              onChange={(e) => setElectricityCost(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Costo de embalaje por defecto"
            htmlFor="settings-packaging"
            hint="Caja, bolsa, etiqueta o protecciones (0 si te sale gratis)."
          >
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

          <Field
            label="Costo de filamento por defecto ($/kg)"
            htmlFor="settings-cost-per-kg"
            hint="Costo base de referencia cuando aún no hay bobinas cargadas."
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

          <Field
            label="Purga multicolor por defecto (gramos)"
            htmlFor="settings-purge"
            hint="Gramos consumidos en torre de purga al imprimir en más de un color."
          >
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

          <Field
            label="Alerta de bobina baja (gramos)"
            htmlFor="settings-low-spool"
            hint="Gramos restantes en bobina para considerar stock bajo."
          >
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
      </Card>

      <Feedback state={state} />

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Guardando ajustes…" : "Guardar ajustes"}
        </button>
      </div>
    </form>
  );
}

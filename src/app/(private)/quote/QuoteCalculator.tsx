"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlicerFileImportButton } from "@/components/SlicerFileImportButton";
import { SmartMoneyInput } from "@/components/SmartMoneyInput";
import { Badge, Card, Field, inputClass } from "@/components/ui";
import {
  MATERIAL_LABEL,
  MATERIALS,
  type Material,
} from "@/lib/catalog-presentation";
import {
  computePieceCost,
  directSaleBreakdown,
  electricityCostPerHourFromKwh,
  printEnergyKwh,
  suggestDirectPrice,
  suggestMlPriceKeeping,
  vatIncluded,
} from "@/lib/costing";
import { currencyDecimals, formatMoney, toMinorUnits, type Currency } from "@/lib/money-format";
import { CHANNEL_LABEL } from "@/lib/order-presentation";
import { ORDER_CHANNELS, type OrderChannel } from "@/lib/order-status";
import { PRINTER_PRESETS } from "@/lib/public-quote";
import type { ParsedSlicerFile } from "@/lib/slicer-file-parser";
import { formatWhatsAppQuote } from "@/lib/whatsapp-quote";
import { createQuotedOrderAction, saveQuoteAsProductAction } from "./actions";

export type MaterialRateInfo = {
  material: Material;
  costPerGram: number;
  activeSpoolsCount: number;
  totalRemainingGrams: number;
};

type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
};

export function QuoteCalculator({
  currency,
  electricityCostPerHour,
  electricityKwhPrice = 0,
  printerWatts = 0,
  machineWearCostPerHour = 0,
  failurePercent = 0,
  defaultPackagingCost,
  defaultPurgeGrams,
  mlCommissionPercent,
  mlDefaultShippingCost,
  vatPercent = 0,
  extraCommissionPercent = 0,
  defaultMarginPercent = 60,
  materialRates,
  customers,
  canEditCatalog,
}: {
  currency: Currency;
  electricityCostPerHour: number;
  /** Precio del kWh y watts de la impresora del perfil, para mostrar cuánta energía usa la pieza. */
  electricityKwhPrice?: number;
  printerWatts?: number;
  /** Desgaste de impresora por hora y % de fallos configurados en el taller (0 = desactivado). */
  machineWearCostPerHour?: number;
  failurePercent?: number;
  defaultPackagingCost: number;
  defaultPurgeGrams: number;
  mlCommissionPercent: number;
  mlDefaultShippingCost: number;
  /** IVA incluido en los precios (0 = no se considera). */
  vatPercent?: number;
  /** Comisión adicional por venta directa (p. ej. Mercado Pago). */
  extraCommissionPercent?: number;
  /** Margen mínimo del taller: punto de partida del cotizador. */
  defaultMarginPercent?: number;
  materialRates: Record<Material, MaterialRateInfo>;
  customers: CustomerOption[];
  canEditCatalog: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const decimals = currencyDecimals(currency);
  const factor = 10 ** decimals;
  const defaultPackagingMajor =
    decimals === 0 ? defaultPackagingCost : defaultPackagingCost / factor;

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [material, setMaterial] = useState<Material>("PETG");
  const [grams, setGrams] = useState("35");
  const [printMinutes, setPrintMinutes] = useState("60");
  const [colorsCount, setColorsCount] = useState("1");
  const [purgeGrams, setPurgeGrams] = useState(String(defaultPurgeGrams));
  const [packagingInput, setPackagingInput] = useState(String(defaultPackagingMajor));
  const [printerPreset, setPrinterPreset] = useState("");
  const [sessionWatts, setSessionWatts] = useState(printerWatts > 0 ? String(printerWatts) : "");
  const [marginTarget, setMarginTarget] = useState(defaultMarginPercent);
  const [qty, setQty] = useState("1");
  const [customUnitPriceInput, setCustomUnitPriceInput] = useState("");
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Estado para convertir en pedido cotizado
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [channel, setChannel] = useState<OrderChannel>("WHATSAPP");
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerInstagram, setNewCustomerInstagram] = useState("");
  const [notes, setNotes] = useState("");

  const [feedback, setFeedback] = useState<{
    tone: "ok" | "danger";
    message: string;
    linkHref?: string;
    linkLabel?: string;
  } | null>(null);

  const activeWatts = Math.max(0, Number(sessionWatts) || 0);
  const effectiveElectricityPerHour =
    printerPreset && electricityKwhPrice > 0
      ? electricityCostPerHourFromKwh(electricityKwhPrice, activeWatts)
      : electricityCostPerHour;

  // Lo que el taller desactivó en su perfil no aparece en el cotizador (se calcula en 0).
  const usesElectricity = effectiveElectricityPerHour > 0 || electricityCostPerHour > 0;
  const usesWear = machineWearCostPerHour > 0;
  const usesFailure = failurePercent > 0;
  const usesPackaging = defaultPackagingCost > 0;
  const sellsOnMercadoLibre = mlCommissionPercent > 0 || mlDefaultShippingCost > 0;

  const parsedGrams = Math.max(0, Number(grams.replace(",", ".")) || 0);
  const parsedMinutes = Math.max(0, Math.round(Number(printMinutes) || 0));
  const parsedColors = Math.min(16, Math.max(1, Math.round(Number(colorsCount) || 1)));
  const parsedPurge = parsedColors > 1 ? Math.max(0, Math.round(Number(purgeGrams) || 0)) : 0;
  const parsedQty = Math.max(1, Math.round(Number(qty) || 1));

  const parseInputMinor = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (decimals === 0) return toMinorUnits(trimmed, currency);
    const num = Number(trimmed.replace(",", "."));
    return Number.isFinite(num) && num >= 0 ? Math.round(num * factor) : null;
  };

  const packagingMinor = usesPackaging ? (parseInputMinor(packagingInput) ?? 0) : 0;

  const energyKwh = printEnergyKwh(activeWatts || printerWatts, parsedMinutes);
  const kwhLabel = (kwh: number) =>
    new Intl.NumberFormat("es-CL", { maximumFractionDigits: kwh < 0.1 ? 3 : 2 }).format(kwh);

  const currentMaterialRate = materialRates[material];
  const costBreakdown = computePieceCost({
    grams: parsedGrams,
    costPerGram: currentMaterialRate.costPerGram,
    printMinutes: parsedMinutes,
    electricityCostPerHour: effectiveElectricityPerHour,
    machineWearCostPerHour,
    failurePercent,
    colorsCount: parsedColors,
    purgeGrams: parsedPurge,
    packagingCost: packagingMinor,
  });

  // Precio sugerido: el menor que deja el margen objetivo después del IVA y la comisión adicional.
  let suggestedDirectMinor = 0;
  try {
    suggestedDirectMinor = suggestDirectPrice({
      totalCost: costBreakdown.totalCost,
      marginPercent: marginTarget,
      vatPercent,
      extraCommissionPercent,
    });
  } catch {
    suggestedDirectMinor = 0;
  }

  // Si el usuario escribió un precio manual, usamos ese; si no, usamos el sugerido
  const parsedCustom = parseInputMinor(customUnitPriceInput);
  const activeUnitPriceMinor = parsedCustom !== null ? parsedCustom : suggestedDirectMinor;

  function handleSlicerParsed(parsed: ParsedSlicerFile) {
    if (!description.trim() && parsed.suggestedName) {
      setDescription(parsed.suggestedName);
    }
    if (parsed.material) setMaterial(parsed.material);
    if (parsed.grams !== null) setGrams(String(parsed.grams));
    if (parsed.printMinutes !== null) setPrintMinutes(String(parsed.printMinutes));
    if (parsed.colorsCount !== null) {
      setColorsCount(String(Math.min(16, Math.max(1, parsed.colorsCount))));
    }
    if (parsed.purgeGrams !== null) setPurgeGrams(String(parsed.purgeGrams));
  }

  const directSale = directSaleBreakdown({
    price: activeUnitPriceMinor,
    totalCost: costBreakdown.totalCost,
    vatPercent,
    extraCommissionPercent,
  });
  const unitProfitDirect = directSale.profit;
  const effectiveMarginPct = directSale.marginPercent;

  // Mercado Libre: precio que conserva lo mismo que la venta directa después de comisión, envío e IVA.
  let suggestedMlMinor = 0;
  try {
    suggestedMlMinor = suggestMlPriceKeeping({
      keepAfterVat: activeUnitPriceMinor - directSale.vat - directSale.extraCommission,
      commissionPct: mlCommissionPercent,
      sellerShippingCost: mlDefaultShippingCost,
      vatPercent,
    });
  } catch {
    suggestedMlMinor = 0;
  }
  const mlVat = vatIncluded(suggestedMlMinor, vatPercent);

  const totalOrderMinor = activeUnitPriceMinor * parsedQty;
  const totalProfitMinor = unitProfitDirect * parsedQty;

  function handleColorsSelect(count: number) {
    setColorsCount(String(count));
    if (count > 1 && Number(purgeGrams) === 0) {
      setPurgeGrams(String(defaultPurgeGrams));
    }
  }

  function handleSaveToCatalog() {
    setFeedback(null);
    const trimmedName = description.trim();
    if (!trimmedName) {
      setFeedback({
        tone: "danger",
        message: "Escribe el nombre de la pieza antes de guardarla en el catálogo.",
      });
      return;
    }

    const saleMajor =
      decimals === 0
        ? String(activeUnitPriceMinor)
        : (activeUnitPriceMinor / factor).toFixed(decimals);
    const mlMajor =
      decimals === 0
        ? String(suggestedMlMinor)
        : (suggestedMlMinor / factor).toFixed(decimals);

    const fd = new FormData();
    fd.set("operationId", crypto.randomUUID());
    fd.set("name", trimmedName);
    fd.set("category", category.trim());
    fd.set("material", material);
    fd.set("grams", String(Math.round(parsedGrams)));
    fd.set("printMinutes", String(parsedMinutes));
    fd.set("colorsCount", String(parsedColors));
    fd.set("purgeGrams", String(parsedPurge));
    fd.set("salePrice", saleMajor);
    fd.set("mlPrice", mlMajor);
    fd.set("initialStock", "0");
    fd.set("minStock", "0");
    fd.set(
      "notes",
      `Cotizada con margen ${effectiveMarginPct}% · Costo est. ${formatMoney(costBreakdown.totalCost, currency)}`
    );

    startTransition(async () => {
      const res = await saveQuoteAsProductAction(fd);
      if (!res.ok) {
        setFeedback({ tone: "danger", message: res.error });
        return;
      }
      setFeedback({
        tone: "ok",
        message: res.message,
        linkHref: `/products/${res.data.id}`,
        linkLabel: "Ver pieza en el catálogo →",
      });
    });
  }

  async function handleCopyWhatsApp() {
    const text = formatWhatsAppQuote({
      pieceName: description.trim() || null,
      material: MATERIAL_LABEL[material],
      quantity: parsedQty,
      grams: parsedGrams,
      colorsCount: parsedColors,
      printMinutes: parsedMinutes,
      unitPrice: activeUnitPriceMinor,
      totalPrice: totalOrderMinor,
      currency,
      includeVat: vatPercent > 0,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsApp(true);
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } catch {
      // Portapapeles restringido por el navegador
    }
  }

  function handleCreateQuotedOrder(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    const trimmedDesc = description.trim() || `Pieza ${MATERIAL_LABEL[material]} (${Math.round(parsedGrams)} g)`;

    startTransition(async () => {
      const res = await createQuotedOrderAction({
        operationId: crypto.randomUUID(),
        channel,
        customerId: customerId || null,
        newCustomerName: customerId ? undefined : newCustomerName.trim() || undefined,
        newCustomerPhone: customerId ? undefined : newCustomerPhone.trim() || undefined,
        newCustomerInstagram: customerId ? undefined : newCustomerInstagram.trim() || undefined,
        notes:
          notes.trim() ||
          `Cotización: ${parsedGrams}g + ${parsedPurge}g purga (${parsedMinutes} min, ${parsedColors} color/es). Costo unitario est.: ${formatMoney(costBreakdown.totalCost, currency)}.`,
        items: [
          {
            description: trimmedDesc,
            qty: parsedQty,
            unitPrice: activeUnitPriceMinor,
            material,
            grams: Math.round(costBreakdown.totalGrams),
            colorsCount: parsedColors,
          },
        ],
      });

      if (!res.ok) {
        setFeedback({ tone: "danger", message: res.error });
        return;
      }

      router.push(`/orders/${res.data.id}`);
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Columna izquierda: Parámetros de la pieza */}
      <div className="lg:col-span-7 space-y-4">
        <Card className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">
              1. Parámetros de impresión
            </h2>
            <Badge tone="neutral">En vivo</Badge>
          </div>

          <SlicerFileImportButton onParsed={handleSlicerParsed} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Field label="Nombre o descripción de la pieza">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Emblema Toyota Hilux TRD"
                  className={inputClass}
                />
              </Field>
            </div>
            <div>
              <Field label="Categoría (opcional)">
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej. Emblemas"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          {PRINTER_PRESETS.length > 0 && (
            <Field
              label="Impresora para esta cotización (opcional)"
              hint={
                electricityKwhPrice > 0
                  ? "Ajusta la potencia solo para calcular esta pieza; no modifica tu configuración guardada."
                  : "Activa el precio del kWh en Ajustes si deseas que ajuste el cálculo eléctrico."
              }
            >
              <select
                value={printerPreset}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrinterPreset(val);
                  const found = PRINTER_PRESETS.find((item) => item.name === val);
                  setSessionWatts(found ? String(found.watts) : String(printerWatts || ""));
                }}
                className={inputClass}
              >
                <option value="">Usar configuración del taller{printerWatts > 0 ? ` (${printerWatts} W)` : ""}</option>
                {PRINTER_PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name} · ≈{preset.watts} W
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Selección táctil de material */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-ink">
              Material
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {MATERIALS.map((mat) => {
                const selected = material === mat;
                const info = materialRates[mat];
                return (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => setMaterial(mat)}
                    className={`min-h-11 rounded-xl border px-2.5 py-2 text-center transition ${
                      selected
                        ? "border-primary bg-primary-soft text-primary-ink font-semibold"
                        : "border-line bg-raised text-ink hover:border-line-strong hover:bg-canvas"
                    }`}
                  >
                    <div className="text-xs">{MATERIAL_LABEL[mat]}</div>
                    <div className="text-[10px] text-muted">
                      {formatMoney(Math.round(info.costPerGram), currency)}/g
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted">
              {currentMaterialRate.activeSpoolsCount > 0 ? (
                <>
                  Promedio real de{" "}
                  <span className="text-ink font-medium">
                    {currentMaterialRate.activeSpoolsCount} bobina(s) activa(s)
                  </span>{" "}
                  de {MATERIAL_LABEL[material]} ({currentMaterialRate.totalRemainingGrams} g disponibles).
                </>
              ) : (
                <>
                  Sin bobinas activas de {MATERIAL_LABEL[material]}; usando el costo por kilo por defecto del taller.
                </>
              )}
            </p>
          </div>

          {/* Gramos y Minutos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Peso de la pieza (g)">
              <input
                type="number"
                min={0}
                step={1}
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Tiempo de impresión (min)">
              <input
                type="number"
                min={0}
                step={1}
                value={printMinutes}
                onChange={(e) => setPrintMinutes(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {/* Atajos de tiempo */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted mr-1">Tiempo rápido:</span>
            {[30, 45, 60, 90, 120, 180, 240].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setPrintMinutes(String(mins))}
                className={`min-h-9 px-2.5 rounded-lg text-xs border transition ${
                  parsedMinutes === mins
                    ? "border-primary bg-primary-soft text-primary-ink font-semibold"
                    : "border-line bg-raised text-ink hover:border-line-strong hover:bg-canvas"
                }`}
              >
                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </button>
            ))}
          </div>

          {/* Colores y purga (la purga solo aparece con más de un color) */}
          <div className={`grid grid-cols-1 gap-3 pt-1 ${parsedColors > 1 ? "sm:grid-cols-2" : ""}`}>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-ink">
                Cantidad de colores (AMS / cambio)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorsSelect(c)}
                    className={`min-h-11 rounded-xl border text-xs font-medium transition ${
                      parsedColors === c
                        ? "border-primary bg-primary-soft text-primary-ink font-semibold"
                        : "border-line bg-raised text-ink hover:border-line-strong hover:bg-canvas"
                    }`}
                  >
                    {c} {c === 1 ? "color" : "colores"}
                  </button>
                ))}
              </div>
            </div>

            {parsedColors > 1 && (
              <Field label="Purga multicolor (g)" hint="Se suma al peso de la pieza.">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={purgeGrams}
                  onChange={(e) => setPurgeGrams(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          {/* Embalaje (si está activo en el perfil) y cantidad */}
          <div className={`grid grid-cols-1 gap-3 pt-1 ${usesPackaging ? "sm:grid-cols-2" : ""}`}>
            {usesPackaging && (
              <Field label={`Embalaje unitario (${currency})`}>
                <SmartMoneyInput
                  currency={currency}
                  value={packagingInput}
                  onChangeValue={setPackagingInput}
                  placeholder="0"
                />
              </Field>
            )}
            <Field label="Cantidad a cotizar">
              <input
                type="number"
                min={1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        {/* Tarjeta 2: Margen objetivo y ajuste de precio */}
        <Card className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">
              2. Margen objetivo y precio comercial
            </h2>
            <Badge tone="accent">Margen {marginTarget}%</Badge>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([40, 50, 60, 70, 80, defaultMarginPercent])).sort((a, b) => a - b).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMarginTarget(m);
                    setCustomUnitPriceInput("");
                  }}
                  className={`min-h-10 px-3 rounded-xl border text-xs font-medium transition ${
                    marginTarget === m && customUnitPriceInput === ""
                      ? "border-primary bg-primary-soft text-primary-ink font-semibold"
                      : "border-line bg-raised text-ink hover:border-line-strong hover:bg-canvas"
                  }`}
                >
                  {m}%{m === defaultMarginPercent ? " · tu mínimo" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label={`Precio unitario final (${currency})`}
              hint="Puedes redondearlo (ej. 8.990) y ver el margen real."
            >
              <SmartMoneyInput
                currency={currency}
                value={customUnitPriceInput}
                onChangeValue={setCustomUnitPriceInput}
                placeholder={
                  decimals === 0
                    ? String(suggestedDirectMinor)
                    : (suggestedDirectMinor / factor).toFixed(decimals)
                }
              />
            </Field>

            <div className="flex flex-col justify-end">
              {customUnitPriceInput.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => setCustomUnitPriceInput("")}
                  className="min-h-11 rounded-xl border border-line bg-raised px-3 text-xs font-medium text-ink hover:bg-canvas"
                >
                  Volver al precio sugerido ({formatMoney(suggestedDirectMinor, currency)})
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Columna derecha: Desglose en vivo y acciones en 1 toque */}
      <div className="lg:col-span-5 space-y-4">
        <Card className="p-4 sm:p-5 space-y-4 border-primary/35">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-ink">
              Resultado de la cotización
            </h2>
            <Badge tone={effectiveMarginPct >= 50 ? "ok" : effectiveMarginPct >= 25 ? "warn" : "danger"}>
              Margen real {effectiveMarginPct}%
            </Badge>
          </div>

          {/* Desglose de costo unitario */}
          <div className="rounded-xl border border-line bg-raised p-3.5 space-y-2 text-xs">
            <div className="flex justify-between gap-2 text-muted">
              <span>
                Filamento ({costBreakdown.totalGrams} g de {MATERIAL_LABEL[material]})
              </span>
              <span className="text-ink font-medium tabular-nums">
                {formatMoney(costBreakdown.materialCost, currency)}
              </span>
            </div>
            {usesElectricity && (
              <div className="flex justify-between gap-2 text-muted">
                <span>
                  Electricidad ({parsedMinutes} min)
                  {energyKwh > 0 && electricityKwhPrice > 0 && (
                    <span className="block text-[11px]">
                      {kwhLabel(energyKwh)} kWh × {formatMoney(electricityKwhPrice, currency)}/kWh
                    </span>
                  )}
                </span>
                <span className="text-ink font-medium tabular-nums">
                  {formatMoney(costBreakdown.electricityCost, currency)}
                </span>
              </div>
            )}
            {usesWear && (
              <div className="flex justify-between gap-2 text-muted">
                <span>Desgaste de impresora ({parsedMinutes} min)</span>
                <span className="text-ink font-medium tabular-nums">
                  {formatMoney(costBreakdown.wearCost, currency)}
                </span>
              </div>
            )}
            {usesFailure && (
              <div className="flex justify-between gap-2 text-muted">
                <span>Respaldo por fallos ({failurePercent}%)</span>
                <span className="text-ink font-medium tabular-nums">
                  {formatMoney(costBreakdown.failureCost, currency)}
                </span>
              </div>
            )}
            {usesPackaging && (
              <div className="flex justify-between gap-2 text-muted">
                <span>Embalaje unitario</span>
                <span className="text-ink font-medium tabular-nums">
                  {formatMoney(costBreakdown.packagingCost, currency)}
                </span>
              </div>
            )}
            <div className="border-t border-line pt-2 flex justify-between gap-2 text-sm font-semibold">
              <span className="text-ink">Costo total unitario</span>
              <span className="text-ink tabular-nums">
                {formatMoney(costBreakdown.totalCost, currency)}
              </span>
            </div>
          </div>

          {/* Precios sugeridos: Directo vs Mercado Libre */}
          <div className={`grid grid-cols-1 gap-3 ${sellsOnMercadoLibre ? "sm:grid-cols-2" : ""}`}>
            <div className="rounded-xl border border-ok/30 bg-ok-soft p-3.5 space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-ok font-semibold">
                Venta directa
              </div>
              <div className="text-xl font-bold text-ink tabular-nums">
                {formatMoney(activeUnitPriceMinor, currency)}
              </div>
              <div className="text-xs text-muted">
                Margen:{" "}
                <span className="font-semibold text-ok tabular-nums">
                  {formatMoney(unitProfitDirect, currency)}
                </span>{" "}
                / ud.
              </div>
              {(directSale.vat > 0 || directSale.extraCommission > 0) && (
                <div className="text-[11px] text-muted">
                  {directSale.vat > 0 && <>Incluye IVA {formatMoney(directSale.vat, currency)}</>}
                  {directSale.vat > 0 && directSale.extraCommission > 0 && " · "}
                  {directSale.extraCommission > 0 && (
                    <>Comisión {extraCommissionPercent}% {formatMoney(directSale.extraCommission, currency)}</>
                  )}
                </div>
              )}
            </div>

            {sellsOnMercadoLibre && (
              <div className="rounded-xl border border-warn/30 bg-warn-soft p-3.5 space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-warn font-semibold">
                  Mercado Libre ({mlCommissionPercent}%)
                </div>
                <div className="text-xl font-bold text-ink tabular-nums">
                  {formatMoney(suggestedMlMinor, currency)}
                </div>
                <div className="text-xs text-muted">
                  Conserva tu margen tras comisión + envío ({formatMoney(mlDefaultShippingCost, currency)})
                  {mlVat > 0 && <> · incluye IVA {formatMoney(mlVat, currency)}</>}
                </div>
              </div>
            )}
          </div>

          {parsedQty > 1 && (
            <div className="rounded-xl border border-line bg-raised p-3 flex items-center justify-between gap-2 text-xs">
              <span className="text-muted">
                Total por <strong className="text-ink">{parsedQty} unidades</strong> (venta directa):
              </span>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-ink tabular-nums">
                  {formatMoney(totalOrderMinor, currency)}
                </div>
                <div className="text-[11px] text-ok font-medium tabular-nums">
                  Margen total: {formatMoney(totalProfitMinor, currency)}
                </div>
              </div>
            </div>
          )}

          {feedback && (
            <div
              className={`rounded-xl border p-3 text-xs ${
                feedback.tone === "ok"
                  ? "border-ok/35 bg-ok-soft text-ok"
                  : "border-danger/35 bg-danger-soft text-danger"
              }`}
            >
              <p>{feedback.message}</p>
              {feedback.linkHref && (
                <Link
                  href={feedback.linkHref}
                  className="mt-1.5 inline-block font-semibold underline"
                >
                  {feedback.linkLabel}
                </Link>
              )}
            </div>
          )}

          {/* Botones de acción en 1 toque */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={isPending}
              onClick={() => setShowOrderPanel((prev) => !prev)}
              className="w-full min-h-12 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold text-sm px-4 py-2.5 transition disabled:opacity-50"
            >
              {showOrderPanel
                ? "Ocultar datos del pedido cotizado"
                : "1. Crear pedido cotizado"}
            </button>

            {canEditCatalog && (
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveToCatalog}
                className="w-full min-h-11 rounded-xl border border-line bg-raised hover:bg-canvas text-ink font-medium text-sm px-4 py-2.5 transition disabled:opacity-50"
              >
                {isPending ? "Guardando…" : "2. Guardar como pieza en el catálogo"}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handleCopyWhatsApp()}
              className="w-full min-h-11 rounded-xl border border-ok/35 bg-ok-soft hover:brightness-95 text-ok font-semibold text-sm px-4 py-2.5 transition"
            >
              {copiedWhatsApp ? "Presupuesto copiado para WhatsApp" : "Copiar presupuesto para WhatsApp"}
            </button>
          </div>

          {/* Panel rápido para crear el pedido cotizado */}
          {showOrderPanel && (
            <form
              onSubmit={handleCreateQuotedOrder}
              className="mt-3 pt-3 border-t border-line space-y-3"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Datos del pedido cotizado
              </h3>

              <Field label="Canal de contacto">
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as OrderChannel)}
                  className={inputClass}
                >
                  {ORDER_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {CHANNEL_LABEL[ch]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cliente existente (opcional)">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Cliente nuevo o sin registrar —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.instagram ? ` (@${c.instagram})` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {!customerId && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Nombre cliente">
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Ej. Carlos Soto"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Teléfono / WhatsApp">
                    <input
                      type="text"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="+56 9..."
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Instagram">
                    <input
                      type="text"
                      value={newCustomerInstagram}
                      onChange={(e) => setNewCustomerInstagram(e.target.value)}
                      placeholder="@usuario"
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}

              <Field label="Notas de la cotización (opcional)">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. Color negro mate, entrega en 48h"
                  className={inputClass}
                />
              </Field>

              <button
                type="submit"
                disabled={isPending}
                className="w-full min-h-11 rounded-xl bg-ok hover:opacity-90 text-white font-semibold text-sm px-4 py-2.5 transition disabled:opacity-50"
              >
                {isPending
                  ? "Guardando…"
                  : `Confirmar cotización por ${formatMoney(totalOrderMinor, currency)}`}
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

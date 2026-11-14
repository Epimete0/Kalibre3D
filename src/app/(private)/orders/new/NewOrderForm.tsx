"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { PieceCombobox } from "@/components/PieceCombobox";
import {
  Badge,
  Card,
  filterChipClass,
  inputClass,
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui";
import { MATERIAL_LABEL, MATERIALS, type Material } from "@/lib/catalog-presentation";
import type { CustomerListItem } from "@/lib/customer-queries";
import { effectiveMlCommission, rememberLastChannel } from "@/lib/last-channel";
import { type MlPriceInputMode, unitPriceForOrderChannel } from "@/lib/ml-pricing";
import { formatMoney } from "@/lib/money-format";
import type { OrderChannel } from "@/lib/order-status";
import type { ProductListItem } from "@/lib/product-queries";
import { createOrderAction } from "../actions";

export type WorkshopSettingsData = {
  currency: string;
  mlCommissionPercent: number;
  mlDefaultShippingCost: number;
};

type FormItem = {
  localId: string;
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  material: string;
  grams: number | null;
  colorsCount: number;
  showCostFields: boolean;
};

const CHANNELS = [
  { id: "WHATSAPP", label: "WhatsApp" },
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "MERCADOLIBRE", label: "Mercado Libre" },
  { id: "IN_PERSON", label: "En persona" },
  { id: "DIGITAL", label: "Archivo digital" },
  { id: "OTHER", label: "Otro" },
] as const;

const METHODS = [
  { id: "TRANSFER", label: "Transferencia" },
  { id: "CASH", label: "Efectivo" },
  { id: "MERCADOPAGO", label: "Mercado Pago" },
  { id: "MERCADOLIBRE", label: "Mercado Libre" },
  { id: "OTHER", label: "Otro" },
] as const;

const KINDS = [
  { id: "QUICK_SALE", label: "Venta rápida", hint: "Entregada y cobrada hoy" },
  { id: "ORDER", label: "Por encargo", hint: "Se fabrica o entrega después" },
] as const;

const emptyItem = (localId: string): FormItem => ({
  localId,
  productId: null,
  description: "",
  qty: 1,
  unitPrice: 0,
  material: "",
  grams: null,
  colorsCount: 1,
  showCostFields: false,
});

export function NewOrderForm({
  operationId,
  products,
  customers,
  settings,
  initialChannel,
}: {
  operationId: string;
  products: ProductListItem[];
  customers: CustomerListItem[];
  settings: WorkshopSettingsData;
  /** Último canal usado en este navegador (cookie de interfaz), para no elegirlo en cada venta. */
  initialChannel: OrderChannel;
}) {
  const [state, runAction, pending] = useActionState(createOrderAction, {});
  const nextIdRef = useRef(2);
  const allocItemId = () => `item-${nextIdRef.current++}`;

  // Modo: venta rápida (entregada y cobrada) vs pedido por encargo
  const [kind, setKind] = useState<"QUICK_SALE" | "ORDER">("QUICK_SALE");
  const [channel, setChannel] = useState<string>(initialChannel);

  // Cliente (D7)
  const [clientMode, setClientMode] = useState<"NONE" | "EXISTING" | "NEW">("NONE");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerInstagram, setNewCustomerInstagram] = useState("");

  // Mercado Libre (D4)
  const [mlPriceMode, setMlPriceMode] = useState<MlPriceInputMode>("PUBLISHED");
  const [mlOrderRef, setMlOrderRef] = useState("");
  // null = la comisión sigue al total; un número = la persona la escribió a mano (o 0 en modo NET).
  const [mlCommissionManual, setMlCommissionManual] = useState<number | null>(null);
  const [mlShippingCost, setMlShippingCost] = useState(settings.mlDefaultShippingCost);

  // Fecha, descuento y notas
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [showMore, setShowMore] = useState(false);

  // Pago
  const [paymentMethod, setPaymentMethod] = useState<string>(
    initialChannel === "MERCADOLIBRE" ? "MERCADOLIBRE" : "TRANSFER"
  );
  const [hasPayment, setHasPayment] = useState(true);
  const [customPaidAmount, setCustomPaidAmount] = useState<number | null>(null);

  // Piezas
  const [items, setItems] = useState<FormItem[]>(() => [emptyItem("item-1")]);

  const isML = channel === "MERCADOLIBRE";
  const productsById = new Map(products.map((p) => [p.id, p]));
  const resolvedUnitPrice = (
    product: ProductListItem,
    targetChannel = channel,
    targetMode = mlPriceMode
  ) => unitPriceForOrderChannel(product, targetChannel, targetMode, settings);

  const rawSubtotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const totalUnits = items.reduce((sum, it) => sum + it.qty, 0);
  const total = Math.max(0, rawSubtotal - discount);
  // La comisión sugerida de Mercado Libre se recalcula sola con el total, salvo que se escriba a mano o se use modo Neto.
  const mlCommission = effectiveMlCommission(total, settings.mlCommissionPercent, mlCommissionManual);

  const handleChannelChange = (newChannel: string) => {
    setChannel(newChannel);
    rememberLastChannel(newChannel as OrderChannel);
    const switchingToML = newChannel === "MERCADOLIBRE";

    setItems((prev) =>
      prev.map((item) => {
        if (!item.productId) return item;
        const found = productsById.get(item.productId);
        if (!found) return item;
        return { ...item, unitPrice: resolvedUnitPrice(found, newChannel, mlPriceMode) };
      })
    );

    if (switchingToML) {
      setPaymentMethod("MERCADOLIBRE");
      if (mlPriceMode === "NET") {
        setMlCommissionManual(0);
        setMlShippingCost(0);
      } else {
        setMlCommissionManual(null);
        setMlShippingCost(settings.mlDefaultShippingCost);
      }
    } else if (paymentMethod === "MERCADOLIBRE") {
      setPaymentMethod("TRANSFER");
    }
  };

  const handleMlPriceModeChange = (nextMode: MlPriceInputMode) => {
    if (nextMode === mlPriceMode) return;
    setMlPriceMode(nextMode);
    setItems((prev) =>
      prev.map((item) => {
        if (!item.productId) return item;
        const found = productsById.get(item.productId);
        if (!found) return item;
        return { ...item, unitPrice: resolvedUnitPrice(found, "MERCADOLIBRE", nextMode) };
      })
    );
    if (nextMode === "NET") {
      setMlCommissionManual(0);
      setMlShippingCost(0);
    } else {
      setMlCommissionManual(null);
      setMlShippingCost(settings.mlDefaultShippingCost);
    }
  };

  const handleProductSelect = (localId: string, productId: string) => {
    if (!productId) {
      setItems((prev) =>
        prev.map((it) => (it.localId === localId ? { ...it, productId: null } : it))
      );
      return;
    }
    const found = productsById.get(productId);
    if (!found) return;

    const price = resolvedUnitPrice(found);
    setItems((prev) =>
      prev.map((it) =>
        it.localId === localId
          ? {
              ...it,
              productId: found.id,
              description: found.name,
              unitPrice: price,
              material: "",
              grams: null,
              colorsCount: found.colorsCount,
              showCostFields: false,
            }
          : it
      )
    );
  };

  const updateItem = (localId: string, patch: Partial<FormItem>) => {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem(allocItemId())]);
  };

  const duplicateItem = (source: FormItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.localId === source.localId);
      const copy: FormItem = { ...source, localId: allocItemId() };
      if (idx === -1) return [...prev, copy];
      return [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
    });
  };

  const removeItem = (localId: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.localId !== localId)));
  };

  // Cálculo neto de Mercado Libre
  const expectedReceivable = isML
    ? Math.max(0, total - mlCommission - mlShippingCost)
    : total;

  // Monto a registrar como pago
  const paymentAmount =
    customPaidAmount !== null
      ? customPaidAmount
      : kind === "QUICK_SALE"
      ? expectedReceivable
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      operationId,
      kind,
      channel,
      status: kind === "QUICK_SALE" ? "DELIVERED" : "CONFIRMED",
      customerId: clientMode === "EXISTING" && selectedCustomerId ? selectedCustomerId : null,
      newCustomerName: clientMode === "NEW" ? newCustomerName : undefined,
      newCustomerPhone: clientMode === "NEW" ? newCustomerPhone : undefined,
      newCustomerInstagram: clientMode === "NEW" ? newCustomerInstagram : undefined,
      dueDate: kind === "ORDER" && dueDate ? dueDate : null,
      discount,
      mlOrderRef: isML && mlOrderRef ? mlOrderRef : null,
      mlCommission: isML ? mlCommission : 0,
      mlShippingCost: isML ? mlShippingCost : 0,
      notes: notes.trim() || null,
      items: items.map((it) => ({
        productId: it.productId,
        description: it.description,
        qty: it.qty,
        unitPrice: it.unitPrice,
        material: it.productId ? null : it.material || null,
        grams: it.productId ? null : it.grams,
        colorsCount: it.colorsCount,
      })),
      initialPayment:
        hasPayment && paymentAmount > 0
          ? {
              amount: paymentAmount,
              method: paymentMethod,
            }
          : undefined,
    };

    startTransition(() => {
      runAction(payload);
    });
  };

  const showExtras = showMore || discount > 0 || notes.trim().length > 0;
  const namedItems = items.filter((it) => it.description.trim().length > 0 || it.unitPrice > 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.error && (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-start gap-5">
        {/* Columna izquierda: Carga de piezas, canal, cliente y extras */}
        <div className="lg:col-span-8 space-y-4">
          {/* 1. Tipo de venta */}
          <div
            role="radiogroup"
            aria-label="Tipo de registro"
            className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-raised p-1"
          >
            {KINDS.map((option) => {
              const selected = kind === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setKind(option.id);
                    if (option.id === "QUICK_SALE") {
                      setHasPayment(true);
                      setCustomPaidAmount(null);
                    }
                  }}
                  className={`flex min-h-11 flex-col sm:flex-row sm:gap-2 items-center justify-center rounded-xl px-3 py-1.5 text-center transition-all duration-150 touch-manipulation ${
                    selected
                      ? "bg-surface text-ink font-bold shadow-[0_1px_2px_rgba(28,29,33,0.06)] border border-line dark:bg-raised"
                      : "text-muted hover:text-ink hover:bg-canvas/50"
                  }`}
                >
                  <span className="text-sm font-semibold">{option.label}</span>
                  <span className={`text-[11px] ${selected ? "text-primary font-medium" : "text-muted"}`}>
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 2. Piezas de la venta */}
          <Card className="p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
                  Piezas
                </h2>
                {(items.length > 1 || totalUnits > 1) && (
                  <Badge tone="neutral">
                    {items.length} {items.length === 1 ? "línea" : "líneas"} · {totalUnits}{" "}
                    {totalUnits === 1 ? "unidad" : "unidades"}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const linkedProduct = item.productId ? productsById.get(item.productId) : undefined;
                const lineSubtotal = item.qty * item.unitPrice;
                const matLabel = linkedProduct
                  ? MATERIAL_LABEL[linkedProduct.material as Material] ?? linkedProduct.material
                  : null;

                return (
                  <div
                    key={item.localId}
                    className={`rounded-2xl border p-3.5 transition-colors space-y-3 ${
                      items.length > 1
                        ? "border-line bg-canvas/50"
                        : "border-line/70 bg-canvas/35"
                    }`}
                  >
                    {/* Cabecera clara de cada pieza con subtotal y acciones rápidas */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-lg border border-line bg-raised px-2 text-xs font-bold text-ink">
                          #{idx + 1}
                        </span>

                        {linkedProduct ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-semibold text-ink">Catálogo</span>
                            <span className="text-muted">
                              · {matLabel}
                              {linkedProduct.grams > 0 ? ` · ${linkedProduct.grams} g` : ""}
                            </span>
                            <Badge
                              tone={
                                linkedProduct.currentStock <= 0
                                  ? "warn"
                                  : linkedProduct.isLowStock
                                    ? "warn"
                                    : "ok"
                              }
                            >
                              {linkedProduct.currentStock <= 0
                                ? "Sin stock listo"
                                : `Stock: ${linkedProduct.currentStock}`}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-muted">Pieza manual</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-sm font-bold text-ink tabular-nums">
                          {formatMoney(lineSubtotal, settings.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => duplicateItem(item)}
                          title="Duplicar esta pieza"
                          aria-label={`Duplicar pieza ${idx + 1}`}
                          className="inline-flex min-h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-[11px] font-semibold text-muted hover:text-ink hover:bg-raised transition-colors touch-manipulation"
                        >
                          Duplicar
                        </button>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.localId)}
                            aria-label={`Quitar pieza ${idx + 1}`}
                            className="inline-flex min-h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-[11px] font-semibold text-danger hover:bg-danger-soft/40 hover:border-danger/40 transition-colors touch-manipulation"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fila 1: Buscador único de catálogo o pieza manual */}
                    <div>
                      <label
                        htmlFor={`item-${item.localId}-description`}
                        className="text-[11px] font-medium text-muted block mb-1"
                      >
                        Pieza *
                      </label>
                      <PieceCombobox
                        id={`item-${item.localId}-description`}
                        products={products}
                        selectedProductId={item.productId}
                        value={item.description}
                        unitPriceForProduct={(p) => resolvedUnitPrice(p)}
                        currency={settings.currency}
                        placeholder={
                          products.length > 0
                            ? "Buscar pieza o escribir manual…"
                            : "Ej: Soporte control gamer"
                        }
                        onSelectProduct={(found) => handleProductSelect(item.localId, found.id)}
                        onManualTextChange={(nextText) =>
                          updateItem(item.localId, {
                            productId: null,
                            description: nextText,
                          })
                        }
                        onClearProduct={() =>
                          updateItem(item.localId, {
                            productId: null,
                            description: "",
                          })
                        }
                      />
                    </div>

                    {/* Fila 2: Precio unitario y cantidad */}
                    <div className="grid grid-cols-12 gap-2.5 items-end">
                      <div className="col-span-6">
                        <label
                          htmlFor={`item-${item.localId}-price`}
                          className="text-[11px] font-medium text-muted block mb-1"
                        >
                          {isML && mlPriceMode === "NET"
                            ? `Neto unitario (${settings.currency})`
                            : `Precio unitario (${settings.currency})`}
                        </label>
                        <MoneyInput
                          id={`item-${item.localId}-price`}
                          required
                          placeholder="0"
                          value={item.unitPrice}
                          onChangeValue={(_, num) =>
                            updateItem(item.localId, { unitPrice: num })
                          }
                          className="font-semibold"
                        />
                      </div>

                      <div className="col-span-6">
                        <label
                          htmlFor={`item-${item.localId}-qty`}
                          className="text-[11px] font-medium text-muted block mb-1"
                        >
                          Cantidad
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Restar una unidad"
                            onClick={() =>
                              updateItem(item.localId, { qty: Math.max(1, item.qty - 1) })
                            }
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-line bg-raised font-bold text-ink hover:bg-surface transition-colors touch-manipulation"
                          >
                            −
                          </button>
                          <input
                            id={`item-${item.localId}-qty`}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            required
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(item.localId, {
                                qty: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className={`${inputClass} min-w-0 text-center font-semibold tabular-nums`}
                          />
                          <button
                            type="button"
                            aria-label="Sumar una unidad"
                            onClick={() => updateItem(item.localId, { qty: item.qty + 1 })}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-line bg-raised font-bold text-ink hover:bg-surface transition-colors touch-manipulation"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Opcional en pieza manual: material y gramos para calcular ganancia real */}
                    {!linkedProduct && (
                      <div className="pt-0.5">
                        {item.showCostFields ? (
                          <div className="rounded-xl border border-line/70 bg-surface/70 p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-muted">
                                Detalle de impresión (opcional, para calcular ganancia real)
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateItem(item.localId, {
                                    showCostFields: false,
                                    material: "",
                                    grams: null,
                                    colorsCount: 1,
                                  })
                                }
                                className="text-[11px] font-medium text-muted hover:text-ink"
                              >
                                Quitar detalle
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label
                                  htmlFor={`item-${item.localId}-material`}
                                  className="text-[11px] text-muted block mb-1"
                                >
                                  Material
                                </label>
                                <select
                                  id={`item-${item.localId}-material`}
                                  value={item.material}
                                  onChange={(e) =>
                                    updateItem(item.localId, { material: e.target.value })
                                  }
                                  className={inputClass}
                                >
                                  <option value="">Sin definir</option>
                                  {MATERIALS.map((mat) => (
                                    <option key={mat} value={mat}>
                                      {MATERIAL_LABEL[mat]}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label
                                  htmlFor={`item-${item.localId}-grams`}
                                  className="text-[11px] text-muted block mb-1"
                                >
                                  Gramos c/u
                                </label>
                                <input
                                  id={`item-${item.localId}-grams`}
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  placeholder="Ej: 45"
                                  value={item.grams ?? ""}
                                  onChange={(e) => {
                                    const val = e.target.value.trim();
                                    updateItem(item.localId, {
                                      grams: val ? Math.max(0, Number(val) || 0) : null,
                                    });
                                  }}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor={`item-${item.localId}-colors`}
                                  className="text-[11px] text-muted block mb-1"
                                >
                                  Colores
                                </label>
                                <input
                                  id={`item-${item.localId}-colors`}
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={16}
                                  value={item.colorsCount}
                                  onChange={(e) =>
                                    updateItem(item.localId, {
                                      colorsCount: Math.max(
                                        1,
                                        Math.min(16, Number(e.target.value) || 1)
                                      ),
                                    })
                                  }
                                  className={inputClass}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateItem(item.localId, { showCostFields: true })}
                            className="text-[11px] font-medium text-muted hover:text-primary transition-colors"
                          >
                            + Indicar material y gramos (opcional, mejora el cálculo de ganancia)
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Botón prominente al pie de las piezas donde termina el recorrido visual */}
            <button
              type="button"
              onClick={addItem}
              className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-raised/50 px-4 py-2.5 text-sm font-bold text-ink hover:bg-raised hover:border-ink/40 transition-colors touch-manipulation"
            >
              <span aria-hidden="true" className="text-base leading-none">+</span>
              <span>Agregar otra pieza</span>
            </button>
          </Card>

          {/* 3. Canal de venta */}
          <Card className="p-4 sm:p-5 space-y-3">
            <p id="channel-label" className="text-xs font-bold uppercase tracking-wider text-muted">
              ¿Por dónde te compraron?
            </p>
            <div role="radiogroup" aria-labelledby="channel-label" className="flex flex-wrap gap-1.5">
              {CHANNELS.map((ch) => {
                const isSelected = channel === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleChannelChange(ch.id)}
                    className={filterChipClass(isSelected)}
                  >
                    <span>{ch.label}</span>
                  </button>
                );
              })}
            </div>

            {isML && (
              <div className="rounded-xl bg-raised/60 border border-line p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink">Opciones de Mercado Libre</span>
                  <div
                    className={`${segmentedTrackClass} p-0.5 text-[11px]`}
                    role="group"
                    aria-label="Modo de precio Mercado Libre"
                  >
                    <button
                      type="button"
                      onClick={() => handleMlPriceModeChange("PUBLISHED")}
                      className={`${segmentedItemClass(mlPriceMode === "PUBLISHED")} px-2.5 py-1 text-[11px]`}
                    >
                      Publicado en ML
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMlPriceModeChange("NET")}
                      className={`${segmentedItemClass(mlPriceMode === "NET")} px-2.5 py-1 text-[11px]`}
                    >
                      Lo que recibo neto
                    </button>
                  </div>
                </div>
                {mlPriceMode === "NET" && (
                  <p className="text-[11px] text-muted">
                    Modo neto directo: los montos de arriba se toman tal cual los recibes, sin descontar comisión ni envío otra vez.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <div>
                    <label htmlFor="ml-ref" className="text-[11px] text-muted block mb-1">
                      ID / Referencia ML
                    </label>
                    <input
                      id="ml-ref"
                      type="text"
                      placeholder="ej. 20000084..."
                      value={mlOrderRef}
                      onChange={(e) => setMlOrderRef(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="ml-commission" className="text-[11px] text-muted block mb-1">
                      Comisión ML ({settings.mlCommissionPercent}%)
                    </label>
                    <MoneyInput
                      id="ml-commission"
                      allowZeroDisplay={mlCommissionManual !== null || mlPriceMode === "NET"}
                      value={mlCommission}
                      onChangeValue={(_, num) => setMlCommissionManual(num)}
                    />
                  </div>
                  <div>
                    <label htmlFor="ml-shipping" className="text-[11px] text-muted block mb-1">
                      Costo de envío a tu cargo
                    </label>
                    <MoneyInput
                      id="ml-shipping"
                      allowZeroDisplay
                      value={mlShippingCost}
                      onChangeValue={(_, num) => setMlShippingCost(num)}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* 4. Fecha de entrega (solo por encargo), Cliente y Más opciones */}
          {kind === "ORDER" && (
            <Card className="p-4 sm:p-5">
              <label htmlFor="order-due-date" className="text-xs font-bold uppercase tracking-wider text-muted block mb-2">
                ¿Para cuándo se entrega? <span className="normal-case font-normal">(opcional)</span>
              </label>
              <input
                id="order-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClass} sm:max-w-xs`}
              />
            </Card>
          )}

          <Card className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Cliente <span className="normal-case font-normal">(opcional)</span>
              </p>
              <div className={segmentedTrackClass}>
                {([
                  { id: "NONE", label: "Sin cliente" },
                  { id: "EXISTING", label: "Elegir" },
                  { id: "NEW", label: "+ Nuevo" },
                ] as const).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={clientMode === mode.id}
                    onClick={() => setClientMode(mode.id)}
                    className={segmentedItemClass(clientMode === mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {clientMode === "EXISTING" && (
              <select
                aria-label="Cliente"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona un cliente…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            )}

            {clientMode === "NEW" && (
              <div className="space-y-2.5">
                <input
                  type="text"
                  required
                  aria-label="Nombre del cliente"
                  placeholder="Nombre del cliente *"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className={inputClass}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="tel"
                    aria-label="Teléfono o WhatsApp"
                    placeholder="Teléfono / WhatsApp"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    aria-label="Instagram"
                    placeholder="Instagram (@usuario)"
                    value={newCustomerInstagram}
                    onChange={(e) => setNewCustomerInstagram(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </Card>

          {showExtras ? (
            <Card className="p-4 sm:p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="order-discount" className="text-xs font-semibold text-ink block mb-1">
                    Descuento ({settings.currency})
                  </label>
                  <MoneyInput
                    id="order-discount"
                    placeholder="0"
                    value={discount}
                    onChangeValue={(_, num) => setDiscount(num)}
                  />
                </div>
                <div>
                  <label htmlFor="order-notes" className="text-xs font-semibold text-ink block mb-1">
                    Notas internas
                  </label>
                  <input
                    id="order-notes"
                    type="text"
                    placeholder="Detalles de fabricación, colores o entrega..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </Card>
          ) : (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="min-h-9 px-1 text-xs font-semibold text-primary hover:underline"
            >
              + Más opciones (descuento, notas)
            </button>
          )}
        </div>

        {/* Columna derecha en escritorio (abajo en móvil): Resumen en vivo + Cobro + Guardar */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                Resumen de venta
              </h2>
              <span className="text-xs text-muted">
                {totalUnits} {totalUnits === 1 ? "pieza" : "piezas"}
              </span>
            </div>

            {/* Desglose visual de piezas agregadas (solo si hay varias líneas) */}
            {items.length > 1 ? (
              <ul className="divide-y divide-line/60 text-xs space-y-0">
                {items.map((it, idx) => (
                  <li key={it.localId} className="flex items-baseline justify-between gap-2 py-1.5 first:pt-0">
                    <span className="min-w-0 truncate text-ink">
                      <span className="font-semibold text-muted">{it.qty}×</span>{" "}
                      {it.description.trim() || `Pieza #${idx + 1}`}
                    </span>
                    <span className="font-semibold text-ink tabular-nums shrink-0">
                      {formatMoney(it.qty * it.unitPrice, settings.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : namedItems.length === 0 ? (
              <p className="text-xs text-muted">
                Agrega al menos una pieza y su precio para ver el total.
              </p>
            ) : null}

            {/* Desglose económico */}
            <dl className="space-y-1.5 border-t border-line/70 pt-3 text-xs">
              {(discount > 0 || (isML && (mlCommission > 0 || mlShippingCost > 0))) && (
                <div className="flex items-center justify-between text-muted">
                  <dt>Subtotal piezas</dt>
                  <dd className="tabular-nums font-medium text-ink">
                    {formatMoney(rawSubtotal, settings.currency)}
                  </dd>
                </div>
              )}
              {discount > 0 && (
                <div className="flex items-center justify-between text-muted">
                  <dt>− Descuento</dt>
                  <dd className="tabular-nums">−{formatMoney(discount, settings.currency)}</dd>
                </div>
              )}
              {isML && mlCommission > 0 && (
                <div className="flex items-center justify-between text-muted">
                  <dt>− Comisión ML</dt>
                  <dd className="tabular-nums">−{formatMoney(mlCommission, settings.currency)}</dd>
                </div>
              )}
              {isML && mlShippingCost > 0 && (
                <div className="flex items-center justify-between text-muted">
                  <dt>− Envío a tu cargo</dt>
                  <dd className="tabular-nums">−{formatMoney(mlShippingCost, settings.currency)}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2 pt-1">
                <dt className="text-xs font-semibold text-muted">
                  {isML ? "Neto ML a recibir" : "Total a cobrar"}
                </dt>
                <dd className="text-2xl font-bold tracking-tight text-ink tabular-nums">
                  {formatMoney(expectedReceivable, settings.currency)}
                </dd>
              </div>
            </dl>

            {/* Cobro / Abono inicial */}
            <div className="border-t border-line/70 pt-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {kind === "QUICK_SALE" ? "Cobro" : "Abono inicial"}
                </span>
                <label className="flex min-h-8 items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPayment}
                    onChange={(e) => setHasPayment(e.target.checked)}
                    className="h-4 w-4 rounded border-line accent-primary"
                  />
                  <span>{kind === "QUICK_SALE" ? "Cobrada ahora" : "Registrar abono"}</span>
                </label>
              </div>

              {hasPayment && (
                <div className="space-y-2.5">
                  {isML ? (
                    <div className="rounded-xl border border-line bg-raised/60 px-3 py-2 text-xs font-medium text-ink">
                      Cobro vía Mercado Libre
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="payment-method" className="text-[11px] text-muted block mb-1">
                        Método de pago
                      </label>
                      <select
                        id="payment-method"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className={inputClass}
                      >
                        {METHODS.filter((m) => m.id !== "MERCADOLIBRE").map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <label htmlFor="payment-amount" className="text-[11px] text-muted">
                        Monto recibido
                      </label>
                      {expectedReceivable > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          {kind === "ORDER" && (
                            <button
                              type="button"
                              onClick={() => setCustomPaidAmount(Math.round(expectedReceivable / 2))}
                              className="text-primary hover:underline"
                            >
                              50%
                            </button>
                          )}
                          {(customPaidAmount !== null || kind === "ORDER") && (
                            <button
                              type="button"
                              onClick={() =>
                                setCustomPaidAmount(kind === "ORDER" ? expectedReceivable : null)
                              }
                              className="text-primary hover:underline"
                            >
                              {kind === "QUICK_SALE" ? "Usar total" : "Total"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <MoneyInput
                      id="payment-amount"
                      placeholder={String(expectedReceivable || 0)}
                      value={paymentAmount}
                      onChangeValue={(digits, num) =>
                        setCustomPaidAmount(digits === "" ? 0 : num)
                      }
                      className="font-semibold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Acciones principales en escritorio */}
            <div className="hidden lg:flex flex-col gap-2 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 touch-manipulation"
              >
                {pending
                  ? "Guardando…"
                  : kind === "QUICK_SALE"
                    ? "Guardar venta"
                    : "Crear pedido"}
              </button>
              <Link
                href="/dashboard"
                className="flex min-h-9 w-full items-center justify-center rounded-xl text-xs font-semibold text-muted hover:text-ink transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* Barra inferior pegajosa solo en móvil/tablet (< lg) */}
      <div className="lg:hidden sticky bottom-20 z-10 rounded-2xl bg-surface/95 backdrop-blur-md border border-line p-3 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-muted block">
              {isML ? "Neto ML a recibir" : "Total a cobrar"}
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xl font-bold tabular-nums text-ink">
                {formatMoney(expectedReceivable, settings.currency)}
              </span>
              {isML && total !== expectedReceivable && (
                <span className="text-xs text-muted line-through tabular-nums">
                  {formatMoney(total, settings.currency)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            <Link
              href="/dashboard"
              className="px-3 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] transition-transform active:scale-95 disabled:opacity-60 touch-manipulation"
            >
              {pending ? "Guardando…" : kind === "QUICK_SALE" ? "Guardar venta" : "Crear pedido"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

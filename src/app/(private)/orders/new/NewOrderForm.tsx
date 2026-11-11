"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Card, filterChipClass, inputClass } from "@/components/ui";
import { effectiveMlCommission, rememberLastChannel } from "@/lib/last-channel";
import { formatMoney } from "@/lib/money-format";
import { unitPriceFor } from "@/lib/order-totals";
import type { CustomerListItem } from "@/lib/customer-queries";
import type { OrderChannel } from "@/lib/order-status";
import type { ProductListItem } from "@/lib/product-queries";
import { createOrderAction } from "../actions";

export type WorkshopSettingsData = {
  currency: string;
  mlCommissionPercent: number;
  mlDefaultShippingCost: number;
};

type FormItem = {
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: number;
  material: string;
  colorsCount: number;
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
  { id: "QUICK_SALE", label: "Venta rápida", hint: "Entregada y cobrada" },
  { id: "ORDER", label: "Por encargo", hint: "Se entrega después" },
] as const;

const emptyItem = (): FormItem => ({
  productId: null,
  description: "",
  qty: 1,
  unitPrice: 0,
  material: "",
  colorsCount: 1,
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
  const [mlOrderRef, setMlOrderRef] = useState("");
  // null = la comisión sigue al total; un número = la persona la escribió a mano.
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
  const [items, setItems] = useState<FormItem[]>([emptyItem()]);

  const isML = channel === "MERCADOLIBRE";

  const rawSubtotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const total = Math.max(0, rawSubtotal - discount);
  // La comisión sugerida de Mercado Libre se recalcula sola con el total, salvo que se escriba a mano.
  const mlCommission = effectiveMlCommission(total, settings.mlCommissionPercent, mlCommissionManual);

  const handleChannelChange = (newChannel: string) => {
    setChannel(newChannel);
    rememberLastChannel(newChannel as OrderChannel);
    const switchingToML = newChannel === "MERCADOLIBRE";

    // Si se pasa a ML, actualizar los precios de lista a precio ML (D4)
    if (switchingToML) {
      setItems((prev) =>
        prev.map((item) => {
          if (!item.productId) return item;
          const found = products.find((p) => p.id === item.productId);
          if (!found) return item;
          return {
            ...item,
            unitPrice: unitPriceFor(found, true),
          };
        })
      );
      setPaymentMethod("MERCADOLIBRE");
      setMlCommissionManual(null);
      setMlShippingCost(settings.mlDefaultShippingCost);
    } else {
      // Si se sale de ML, restaurar precios normales
      setItems((prev) =>
        prev.map((item) => {
          if (!item.productId) return item;
          const found = products.find((p) => p.id === item.productId);
          if (!found) return item;
          return {
            ...item,
            unitPrice: unitPriceFor(found, false),
          };
        })
      );
      if (paymentMethod === "MERCADOLIBRE") {
        setPaymentMethod("TRANSFER");
      }
    }
  };

  const handleProductSelect = (index: number, productId: string) => {
    if (!productId) {
      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, productId: null } : it))
      );
      return;
    }
    const found = products.find((p) => p.id === productId);
    if (!found) return;

    const price = unitPriceFor(found, isML);
    setItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              productId: found.id,
              description: found.name,
              unitPrice: price,
            }
          : it
      )
    );
  };

  const updateItem = (index: number, patch: Partial<FormItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
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
        material: it.material || null,
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

  return (
    <form onSubmit={handleSubmit} className="pb-32 space-y-4 max-w-2xl mx-auto">
      {/* Alerta de error si falla */}
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* 1. Tipo de registro: selector compacto */}
      <div role="radiogroup" aria-label="Tipo de registro" className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-raised/70 p-1 shadow-inner">
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
                if (option.id === "QUICK_SALE") setHasPayment(true);
              }}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-1.5 text-center transition-all duration-150 touch-manipulation ${
                selected
                  ? "bg-surface text-ink font-bold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:bg-raised dark:border-line border border-line/60"
                  : "text-muted hover:text-ink hover:bg-canvas/50"
              }`}
            >
              <span className="text-sm font-semibold">{option.label}</span>
              <span className={`text-[11px] ${selected ? "text-primary font-medium" : "text-muted"}`}>{option.hint}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Qué vendiste: lo único obligatorio */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">
            ¿Qué vendiste?{items.length > 1 ? ` (${items.length} piezas)` : ""}
          </h2>
          <button
            type="button"
            onClick={addItem}
            className="min-h-10 px-1 text-xs font-semibold text-primary hover:underline"
          >
            + Otra pieza
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`space-y-2.5 ${items.length > 1 ? "p-3 rounded-xl border border-line bg-canvas/40" : ""}`}
            >
              {items.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-muted">Pieza #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs text-danger hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              )}

              {/* Selector rápido desde catálogo */}
              {products.length > 0 && (
                <select
                  aria-label={`Elegir pieza ${idx + 1} de tu catálogo`}
                  value={item.productId || ""}
                  onChange={(e) => handleProductSelect(idx, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Elegir de tu catálogo… (o escribe abajo)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(unitPriceFor(p, isML), settings.currency)}
                    </option>
                  ))}
                </select>
              )}

              {/* Descripción manual */}
              <label htmlFor={`item-${idx}-description`} className="sr-only">
                Descripción de la pieza {idx + 1}
              </label>
              <input
                id={`item-${idx}-description`}
                type="text"
                required
                placeholder="Ej: Emblema Toyota Yaris *"
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                className={inputClass}
              />

              {/* Precio unitario y cantidad */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`item-${idx}-price`} className="text-[11px] text-muted block mb-1">
                    Precio ({settings.currency})
                  </label>
                  <input
                    id={`item-${idx}-price`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    required
                    value={item.unitPrice || ""}
                    onChange={(e) => updateItem(idx, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor={`item-${idx}-qty`} className="text-[11px] text-muted block mb-1">Cantidad</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Restar una unidad"
                      onClick={() => updateItem(idx, { qty: Math.max(1, item.qty - 1) })}
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-line bg-raised font-bold text-ink"
                    >
                      -
                    </button>
                    <input
                      id={`item-${idx}-qty`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      required
                      value={item.qty}
                      onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      className={`${inputClass} min-w-0 text-center`}
                    />
                    <button
                      type="button"
                      aria-label="Sumar una unidad"
                      onClick={() => updateItem(idx, { qty: item.qty + 1 })}
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-line bg-raised font-bold text-ink"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Subtotal de línea: solo aporta si hay varias unidades o piezas */}
              {(items.length > 1 || item.qty > 1) && (
                <div className="text-right text-xs text-muted">
                  Subtotal:{" "}
                  <span className="font-semibold text-ink">
                    {formatMoney(item.qty * item.unitPrice, settings.currency)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Canal de venta (se recuerda el último usado) */}
      <Card className="p-3 sm:p-4">
        <p id="channel-label" className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">
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

        {/* Parámetros de Mercado Libre */}
        {isML && (
          <div className="mt-4 p-3 rounded-xl bg-accent-soft/40 border border-accent/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Opciones de Mercado Libre</span>
              <span className="text-[11px] text-muted">Precios ML activos</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label htmlFor="ml-ref" className="text-[11px] text-muted block mb-1">ID / Referencia ML</label>
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
                <label htmlFor="ml-commission" className="text-[11px] text-muted block mb-1">Comisión ML ({settings.mlCommissionPercent}%)</label>
                <input
                  id="ml-commission"
                  type="number"
                  inputMode="numeric"
                  value={mlCommission || ""}
                  onChange={(e) => setMlCommissionManual(Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ml-shipping" className="text-[11px] text-muted block mb-1">Costo de envío a tu cargo</label>
                <input
                  id="ml-shipping"
                  type="number"
                  inputMode="numeric"
                  value={mlShippingCost || ""}
                  onChange={(e) => setMlShippingCost(Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* 4. Fecha de entrega (solo pedidos por encargo) */}
      {kind === "ORDER" && (
        <Card className="p-3 sm:p-4">
          <label htmlFor="order-due-date" className="text-xs font-semibold text-ink block mb-1">
            ¿Para cuándo es? <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            id="order-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputClass}
          />
        </Card>
      )}

      {/* 5. Cliente (D7) */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Cliente <span className="normal-case font-normal">(opcional)</span>
          </p>
          <div className="flex items-center gap-1">
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
                className={`min-h-9 px-2 text-xs rounded-lg font-medium transition-colors ${
                  clientMode === mode.id ? "bg-primary text-white" : "text-muted hover:text-ink"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {clientMode === "EXISTING" && (
          <div className="mt-2">
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
          </div>
        )}

        {clientMode === "NEW" && (
          <div className="mt-2 space-y-2.5">
            <input
              type="text"
              required
              aria-label="Nombre del cliente"
              placeholder="Nombre del cliente *"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-2">
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

      {/* 6. Cobro / Pago */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            {kind === "QUICK_SALE" ? "Cobro" : "Abono inicial"}
          </p>
          <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={hasPayment}
              onChange={(e) => setHasPayment(e.target.checked)}
              className="rounded border-line"
            />
            <span>{kind === "QUICK_SALE" ? "Registrar cobro ahora" : "Registrar abono"}</span>
          </label>
        </div>

        {hasPayment && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-line/60">
            <div>
              <label htmlFor="payment-method" className="text-[11px] text-muted block mb-1">Método de pago</label>
              <select
                id="payment-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputClass}
              >
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="payment-amount" className="text-[11px] text-muted block mb-1">Monto recibido</label>
              <input
                id="payment-amount"
                type="number"
                inputMode="numeric"
                min={0}
                value={paymentAmount || ""}
                onChange={(e) => setCustomPaidAmount(Number(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </Card>

      {/* 7. Más opciones: descuento y notas, ocultas hasta que se pidan */}
      {showExtras ? (
        <Card className="p-3 sm:p-4 space-y-3">
          <div>
            <label htmlFor="order-discount" className="text-xs font-semibold text-ink block mb-1">
              Descuento ({settings.currency})
            </label>
            <input
              id="order-discount"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={discount || ""}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="order-notes" className="text-xs font-semibold text-ink block mb-1">Notas internas</label>
            <textarea
              id="order-notes"
              rows={2}
              placeholder="Detalles de fabricación, colores o entrega..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="min-h-10 px-1 text-xs font-semibold text-primary hover:underline"
        >
          + Más opciones (descuento, notas)
        </button>
      )}

      {/* 8. Barra inferior pegajosa (sin pisar MobileNav ni Sidebar) */}
      <div className="sticky bottom-20 lg:bottom-4 z-10 rounded-2xl bg-surface/95 backdrop-blur-md border border-line p-3 sm:p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-muted block">
              {isML ? "Neto ML a recibir" : "Total a cobrar"}
            </span>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold tabular-nums text-ink">
                {formatMoney(expectedReceivable, settings.currency)}
              </span>
              {isML && (
                <span className="text-xs text-muted line-through tabular-nums">
                  {formatMoney(total, settings.currency)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Link
              href="/dashboard"
              className="px-3 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 sm:px-6 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60"
            >
              {pending ? "Guardando…" : kind === "QUICK_SALE" ? "Guardar venta" : "Crear pedido"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

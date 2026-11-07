"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { Card, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import { unitPriceFor } from "@/lib/order-totals";
import type { CustomerListItem } from "@/lib/customer-queries";
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
  { id: "WHATSAPP", label: "WhatsApp", icon: "💬" },
  { id: "INSTAGRAM", label: "Instagram", icon: "📸" },
  { id: "MERCADOLIBRE", label: "Mercado Libre", icon: "📦" },
  { id: "IN_PERSON", label: "En persona", icon: "🤝" },
  { id: "DIGITAL", label: "Archivo digital", icon: "💾" },
  { id: "OTHER", label: "Otro", icon: "📝" },
] as const;

const METHODS = [
  { id: "TRANSFER", label: "Transferencia" },
  { id: "CASH", label: "Efectivo" },
  { id: "MERCADOPAGO", label: "Mercado Pago" },
  { id: "MERCADOLIBRE", label: "Mercado Libre" },
  { id: "OTHER", label: "Otro" },
] as const;

export function NewOrderForm({
  operationId,
  products,
  customers,
  settings,
}: {
  operationId: string;
  products: ProductListItem[];
  customers: CustomerListItem[];
  settings: WorkshopSettingsData;
}) {
  const [state, runAction, pending] = useActionState(createOrderAction, {});

  // Modo: venta rápida (entregada y cobrada) vs pedido por encargo
  const [kind, setKind] = useState<"QUICK_SALE" | "ORDER">("QUICK_SALE");
  const [channel, setChannel] = useState<string>("WHATSAPP");

  // Cliente (D7)
  const [clientMode, setClientMode] = useState<"NONE" | "EXISTING" | "NEW">("NONE");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerInstagram, setNewCustomerInstagram] = useState("");

  // Mercado Libre (D4)
  const [mlOrderRef, setMlOrderRef] = useState("");
  const [mlCommission, setMlCommission] = useState(0);
  const [mlShippingCost, setMlShippingCost] = useState(settings.mlDefaultShippingCost);

  // Fecha y descuento
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");

  // Pago
  const [paymentMethod, setPaymentMethod] = useState<string>("TRANSFER");
  const [hasPayment, setHasPayment] = useState(true);
  const [customPaidAmount, setCustomPaidAmount] = useState<number | null>(null);

  // Piezas
  const [items, setItems] = useState<FormItem[]>([
    {
      productId: null,
      description: "",
      qty: 1,
      unitPrice: 0,
      material: "PLA",
      colorsCount: 1,
    },
  ]);

  const isML = channel === "MERCADOLIBRE";

  // Recalcular comisión sugerida de Mercado Libre cuando cambia el total
  const rawSubtotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);
  const total = Math.max(0, rawSubtotal - discount);

  const handleChannelChange = (newChannel: string) => {
    setChannel(newChannel);
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
      const suggestedComm = Math.round((total * settings.mlCommissionPercent) / 100);
      setMlCommission(suggestedComm);
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
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        description: "",
        qty: 1,
        unitPrice: 0,
        material: "PLA",
        colorsCount: 1,
      },
    ]);
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

  return (
    <form onSubmit={handleSubmit} className="pb-32 space-y-4 max-w-2xl mx-auto">
      {/* Alerta de error si falla */}
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger-soft p-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* 1. Selector de Tipo: Venta rápida vs Pedido */}
      <Card className="p-3 sm:p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
          Tipo de registro
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setKind("QUICK_SALE");
              setHasPayment(true);
            }}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
              kind === "QUICK_SALE"
                ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                : "border-line bg-surface text-ink hover:bg-canvas"
            }`}
          >
            <span className="text-xl">⚡</span>
            <span className="text-sm mt-1">Venta rápida</span>
            <span className="text-[11px] text-muted font-normal mt-0.5">Entregada y cobrada</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setKind("ORDER");
            }}
            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
              kind === "ORDER"
                ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                : "border-line bg-surface text-ink hover:bg-canvas"
            }`}
          >
            <span className="text-xl">📦</span>
            <span className="text-sm mt-1">Pedido por encargo</span>
            <span className="text-[11px] text-muted font-normal mt-0.5">Fabricar o entregar después</span>
          </button>
        </div>
      </Card>

      {/* 2. Canal de Venta */}
      <Card className="p-3 sm:p-4">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted block mb-2">
          Canal de venta
        </label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {CHANNELS.map((ch) => {
            const isSelected = channel === ch.id;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleChannelChange(ch.id)}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-center transition-all ${
                  isSelected
                    ? "border-primary bg-primary text-white font-semibold shadow-sm"
                    : "border-line bg-raised text-ink hover:bg-canvas"
                }`}
              >
                <span className="text-base">{ch.icon}</span>
                <span className="text-xs mt-1 truncate w-full">{ch.label}</span>
              </button>
            );
          })}
        </div>

        {/* Parámetros de Mercado Libre */}
        {isML && (
          <div className="mt-4 p-3 rounded-xl bg-accent-soft/40 border border-accent/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink">📦 Opciones de Mercado Libre</span>
              <span className="text-[11px] text-muted">Precios ML activos</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-muted block mb-1">ID / Referencia ML</label>
                <input
                  type="text"
                  placeholder="ej. 20000084..."
                  value={mlOrderRef}
                  onChange={(e) => setMlOrderRef(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">Comisión ML ({settings.mlCommissionPercent}%)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={mlCommission || ""}
                  onChange={(e) => setMlCommission(Number(e.target.value) || 0)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">Costo de envío a tu cargo</label>
                <input
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

      {/* 3. Cliente (D7) */}
      <Card className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Cliente (opcional)
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setClientMode("NONE")}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                clientMode === "NONE" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
            >
              Sin cliente
            </button>
            <button
              type="button"
              onClick={() => setClientMode("EXISTING")}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                clientMode === "EXISTING" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
            >
              Elegir
            </button>
            <button
              type="button"
              onClick={() => setClientMode("NEW")}
              className={`px-2 py-1 text-xs rounded-lg font-medium transition-colors ${
                clientMode === "NEW" ? "bg-primary text-white" : "text-muted hover:text-ink"
              }`}
            >
              + Nuevo
            </button>
          </div>
        </div>

        {clientMode === "EXISTING" && (
          <div className="mt-2">
            <select
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
              placeholder="Nombre del cliente *"
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="tel"
                placeholder="Teléfono / WhatsApp"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Instagram (@usuario)"
                value={newCustomerInstagram}
                onChange={(e) => setNewCustomerInstagram(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        )}
      </Card>

      {/* 4. Piezas / Items */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            Piezas del pedido ({items.length})
          </label>
          <button
            type="button"
            onClick={addItem}
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Agregar otra pieza
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-line bg-canvas/40 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-muted">Pieza #{idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-xs text-danger hover:underline"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              {/* Selector rápido desde catálogo */}
              {products.length > 0 && (
                <select
                  value={item.productId || ""}
                  onChange={(e) => handleProductSelect(idx, e.target.value)}
                  className="w-full rounded-lg border border-line/80 bg-raised px-2.5 py-1.5 text-xs text-ink shadow-sm"
                >
                  <option value="">Elegir de la lista de piezas…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatMoney(unitPriceFor(p, isML), settings.currency)}
                    </option>
                  ))}
                </select>
              )}

              {/* Descripción manual */}
              <input
                type="text"
                required
                placeholder="Descripción de la pieza *"
                value={item.description}
                onChange={(e) => updateItem(idx, { description: e.target.value })}
                className={inputClass}
              />

              {/* Cantidad y Precio unitario */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted block mb-1">Cantidad</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateItem(idx, { qty: Math.max(1, item.qty - 1) })}
                      className="h-10 w-10 flex items-center justify-center rounded-lg border border-line bg-raised font-bold text-ink"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      required
                      value={item.qty}
                      onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
                      className={`${inputClass} text-center`}
                    />
                    <button
                      type="button"
                      onClick={() => updateItem(idx, { qty: item.qty + 1 })}
                      className="h-10 w-10 flex items-center justify-center rounded-lg border border-line bg-raised font-bold text-ink"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-muted block mb-1">Precio unitario</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    required
                    value={item.unitPrice || ""}
                    onChange={(e) => updateItem(idx, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Subtotal de línea */}
              <div className="text-right text-xs text-muted">
                Subtotal:{" "}
                <span className="font-semibold text-ink">
                  {formatMoney(item.qty * item.unitPrice, settings.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 5. Descuento, Fecha de entrega y Notas */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kind === "ORDER" && (
            <div>
              <label className="text-xs font-semibold text-ink block mb-1">Fecha de entrega</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-ink block mb-1">Descuento ({settings.currency})</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              value={discount || ""}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink block mb-1">Notas internas del pedido</label>
          <textarea
            rows={2}
            placeholder="Detalles de fabricación, colores o entrega..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </div>
      </Card>

      {/* 6. Cobro / Pago */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted">
            {kind === "QUICK_SALE" ? "Cobro realizado" : "Abono inicial"}
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
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
              <label className="text-[11px] text-muted block mb-1">Método de pago</label>
              <select
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
              <label className="text-[11px] text-muted block mb-1">Monto recibido</label>
              <input
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

      {/* 7. Barra Inferior Pegajosa para Móvil y Escritorio (sin pisar MobileNav ni Sidebar) */}
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

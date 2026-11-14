"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Card,
  EmptyState,
  filterChipClass,
  inputClass,
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui";
import { vatIncluded } from "@/lib/costing";
import type { SalesEconomicsSummary } from "@/lib/insights";
import { formatMoney } from "@/lib/money-format";
import {
  CATEGORY_LABEL,
  MANUAL_EXPENSE_CATEGORIES,
  MANUAL_INCOME_CATEGORIES,
  METHOD_LABEL,
  PAYMENT_METHODS,
  type MoneyCategory,
  type PaymentMethod,
} from "@/lib/money-presentation";
import type { MonthlyMoneyView } from "@/lib/money-queries";
import { CHANNEL_LABEL, orderNumberLabel } from "@/lib/order-presentation";
import type { OrderChannel } from "@/lib/order-status";
import { recordManualMoneyAction, voidMoneyAction } from "./actions";
import { formatDay } from "@/lib/date-labels";

function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  const idx = Number.parseInt(m ?? "1", 10) - 1;
  const monthName = MONTH_NAMES[idx] ?? monthStr;
  return `${monthName} ${y}`;
}

function marginTone(margin: number | null): "ok" | "warn" | "danger" | "neutral" {
  if (margin === null) return "neutral";
  if (margin >= 50) return "ok";
  if (margin >= 25) return "warn";
  return "danger";
}

export function MoneyControls({
  view,
  salesSummary,
  currency,
  vatPercent = 0,
  initialMode = null,
}: {
  view: MonthlyMoneyView;
  salesSummary: SalesEconomicsSummary;
  currency: string;
  vatPercent?: number;
  initialMode?: "EXPENSE" | "INCOME" | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formMode, setFormMode] = useState<"EXPENSE" | "INCOME" | null>(initialMode);
  const [operationId, setOperationId] = useState<string>(() => makeUuid());
  const [category, setCategory] = useState<string>(
    initialMode === "INCOME" ? "DIGITAL_SALE" : "FILAMENT"
  );
  const [amountStr, setAmountStr] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("TRANSFER");
  const [occurredOn, setOccurredOn] = useState(view.todayStr);
  const [notes, setNotes] = useState("");

  const [txFilter, setTxFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function openForm(mode: "EXPENSE" | "INCOME") {
    setError(null);
    setMessage(null);
    setFormMode(mode);
    setCategory(mode === "EXPENSE" ? "FILAMENT" : "DIGITAL_SALE");
    setAmountStr("");
    setNotes("");
    setOccurredOn(view.todayStr);
  }

  function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!formMode) return;
    setError(null);
    setMessage(null);

    const amount = Number.parseInt(amountStr, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }

    startTransition(async () => {
      const res = await recordManualMoneyAction({
        operationId,
        type: formMode,
        category,
        amount,
        method,
        occurredOn,
        notes: notes.trim() || null,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Movimiento registrado correctamente.");
        setOperationId(makeUuid());
        setAmountStr("");
        setNotes("");
        setFormMode(null);
        router.refresh();
      }
    });
  }

  function handleVoid(txId: string) {
    setError(null);
    setMessage(null);
    if (!voidReason.trim()) {
      setError("Debes indicar el motivo de la anulación.");
      return;
    }

    startTransition(async () => {
      const res = await voidMoneyAction({
        transactionId: txId,
        reason: voidReason.trim(),
      });
      if (res.error) {
        setError(res.error);
      } else {
        setMessage(res.message ?? "Movimiento anulado correctamente.");
        setVoidingId(null);
        setVoidReason("");
        router.refresh();
      }
    });
  }

  const incomeChannels = Object.entries(view.summary.incomeByChannel).sort(
    (a, b) => b[1] - a[1]
  );
  const expenseCategories = Object.entries(view.summary.expenseByCategory).sort(
    (a, b) => b[1] - a[1]
  );

  const grossIncome = view.summary.income;
  const cashVatAmount = vatIncluded(grossIncome, vatPercent);
  const netCashIncome = grossIncome - cashVatAmount;
  const cashAvailable = netCashIncome - view.summary.expense;

  const validTransactions = view.transactions.filter((t) => t.voidedAt === null);
  const expenseCount = validTransactions.filter((t) => t.type === "EXPENSE").length;
  const incomeCount = validTransactions.filter((t) => t.type === "INCOME").length;

  const visibleTransactions =
    txFilter === "ALL"
      ? view.transactions
      : view.transactions.filter((t) => t.type === txFilter);

  const salesProfitShare =
    salesSummary.grossRevenue > 0
      ? Math.max(0, Math.min(100, Math.round((Math.max(0, salesSummary.netProfit) / salesSummary.grossRevenue) * 100)))
      : 0;
  const salesVatShare =
    salesSummary.grossRevenue > 0 && salesSummary.vatAmount > 0
      ? Math.max(0, Math.min(100 - salesProfitShare, Math.round((salesSummary.vatAmount / salesSummary.grossRevenue) * 100)))
      : 0;
  const salesCostShare = Math.max(0, 100 - salesProfitShare - salesVatShare);

  return (
    <div className="space-y-5">
      {/* Barra superior: Selector de mes y botones de alta rápida (390px) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center justify-between sm:justify-start gap-2 rounded-2xl border border-line bg-surface p-1.5 shadow-sm">
          <Link
            href={`/money?month=${view.previousMonth}`}
            aria-label="Mes anterior"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-line/60 bg-raised px-3 text-sm font-bold text-ink hover:bg-canvas transition-colors touch-manipulation"
          >
            ←
          </Link>
          <span className="px-3 text-sm sm:text-base font-bold text-ink">
            {formatMonthLabel(view.month)}
          </span>
          <Link
            href={`/money?month=${view.nextMonth}`}
            aria-label="Mes siguiente"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-line/60 bg-raised px-3 text-sm font-bold text-ink hover:bg-canvas transition-colors touch-manipulation"
          >
            →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => openForm("EXPENSE")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-hover px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_rgba(217,83,30,0.25)] ring-1 ring-inset ring-white/20 transition-all hover:brightness-105 active:scale-[0.98] touch-manipulation"
          >
            + Registrar gasto
          </button>
          <button
            type="button"
            onClick={() => openForm("INCOME")}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-ink shadow-xs hover:bg-raised transition-all active:scale-[0.98] touch-manipulation"
          >
            + Otro ingreso
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-xs sm:text-sm font-medium text-danger"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-xs sm:text-sm font-medium text-ok"
        >
          {message}
        </div>
      )}

      {/* Formulario táctil de alta rápida de gasto o ingreso suelto */}
      {formMode && (
        <Card className="p-4 sm:p-5 border-primary/30 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">
              {formMode === "EXPENSE"
                ? "Registrar gasto del taller"
                : "Registrar ingreso suelto (ej. venta de archivo)"}
            </h2>
            <div className={segmentedTrackClass}>
              <button
                type="button"
                onClick={() => openForm("EXPENSE")}
                className={segmentedItemClass(formMode === "EXPENSE")}
              >
                Gasto
              </button>
              <button
                type="button"
                onClick={() => openForm("INCOME")}
                className={segmentedItemClass(formMode === "INCOME")}
              >
                Ingreso
              </button>
            </div>
          </div>

          <form onSubmit={handleRecord} className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink">
                Categoría *
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(formMode === "EXPENSE"
                  ? MANUAL_EXPENSE_CATEGORIES
                  : MANUAL_INCOME_CATEGORIES
                ).map((cat) => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={filterChipClass(active)}
                    >
                      {CATEGORY_LABEL[cat as MoneyCategory]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Monto *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="Ej. 15000"
                  disabled={isPending}
                  className={`${inputClass} min-h-11 text-base font-bold`}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Método *
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  disabled={isPending}
                  className={`${inputClass} min-h-11 text-base sm:text-sm`}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink">
                  Fecha *
                </label>
                <input
                  type="date"
                  required
                  value={occurredOn}
                  onChange={(e) => setOccurredOn(e.target.value)}
                  disabled={isPending}
                  className={`${inputClass} min-h-11 text-base sm:text-sm`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">
                Descripción / Nota opcional
              </label>
              <input
                type="text"
                maxLength={300}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  formMode === "EXPENSE"
                    ? "Ej. 1 kg PETG negro, boquillas 0.4mm…"
                    : "Ej. Venta STL en Cults3D…"
                }
                disabled={isPending}
                className={`${inputClass} min-h-10 text-sm`}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setFormMode(null)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-surface px-4 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 touch-manipulation"
              >
                {isPending
                  ? "Guardando…"
                  : formMode === "EXPENSE"
                    ? "Guardar gasto"
                    : "Guardar ingreso"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Bloque principal: Resultado de ventas (con costos reales) vs Flujo de caja */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* 1. Resultado económico de las ventas del mes */}
        <Card className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  Resultado de tus ventas
                </span>
                <p className="text-xs text-muted mt-0.5">
                  {salesSummary.ordersCount}{" "}
                  {salesSummary.ordersCount === 1 ? "pedido vendido" : "pedidos vendidos"} ·{" "}
                  {salesSummary.units}{" "}
                  {salesSummary.units === 1 ? "pieza" : "piezas"} en {formatMonthLabel(view.month)}
                </p>
              </div>
              {salesSummary.marginPercent !== null && (
                <Badge tone={marginTone(salesSummary.marginPercent)}>
                  {salesSummary.marginPercent}% margen real
                </Badge>
              )}
            </div>

            {salesSummary.ordersCount === 0 ? (
              <div className="rounded-xl border border-line/70 bg-raised/40 p-4 space-y-2.5">
                <p className="text-sm font-medium text-ink">
                  Todavía no hay pedidos confirmados en {formatMonthLabel(view.month)}.
                </p>
                <p className="text-xs text-muted">
                  Cuando registres ventas, aquí verás cuánto te dejó cada pedido después de descontar el filamento, la luz y el embalaje.
                </p>
                <Link
                  href="/orders/new"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
                >
                  + Registrar venta
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-xs text-muted block">
                      Ganancia real estimada{vatPercent > 0 ? " (después de IVA y costos)" : " (después de costos)"}
                    </span>
                    <span
                      className={`mt-0.5 block text-3xl sm:text-4xl font-bold tracking-tight tabular-nums ${
                        salesSummary.netProfit >= 0 ? "text-ok" : "text-danger"
                      }`}
                    >
                      {salesSummary.netProfit >= 0 ? "+" : ""}
                      {formatMoney(salesSummary.netProfit, currency)}
                    </span>
                  </div>
                </div>

                {/* Barra visual proporcional: Ganancia vs Costos vs IVA */}
                {salesSummary.grossRevenue > 0 && (
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-full bg-raised overflow-hidden flex">
                      {salesProfitShare > 0 && (
                        <div
                          className="h-full bg-ok transition-all duration-300"
                          style={{ width: `${salesProfitShare}%` }}
                          title={`Ganancia ${salesProfitShare}%`}
                        />
                      )}
                      {salesCostShare > 0 && (
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${salesCostShare}%` }}
                          title={`Costo de fabricación ${salesCostShare}%`}
                        />
                      )}
                      {salesVatShare > 0 && (
                        <div
                          className="h-full bg-line-strong transition-all duration-300"
                          style={{ width: `${salesVatShare}%` }}
                          title={`IVA retenido ${salesVatShare}%`}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" />
                        Ganancia: <strong className="text-ink font-semibold">{salesProfitShare}%</strong>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                        Costo fabricación: <strong className="text-ink font-semibold">{salesCostShare}%</strong>
                      </span>
                      {salesVatShare > 0 && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-line-strong" aria-hidden="true" />
                          IVA: <strong className="text-ink font-semibold">{salesVatShare}%</strong>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Cascada numérica paso a paso */}
                <dl className="divide-y divide-line/60 rounded-xl border border-line/70 bg-canvas/50 px-3.5 py-1 text-sm">
                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-muted">
                      Ventas del mes
                      <span className="block text-[11px]">Neto tras descuentos y cargos de ML</span>
                    </dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {formatMoney(salesSummary.grossRevenue, currency)}
                    </dd>
                  </div>

                  {vatPercent > 0 && (
                    <div className="flex items-center justify-between gap-2 py-2.5">
                      <dt className="text-muted">
                        − IVA retenido ({vatPercent}%)
                        <span className="block text-[11px]">Por pagar a impuestos · Neto taller: {formatMoney(salesSummary.netRevenue, currency)}</span>
                      </dt>
                      <dd className="font-medium text-muted tabular-nums">
                        −{formatMoney(salesSummary.vatAmount, currency)}
                      </dd>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 py-2.5">
                    <dt className="text-muted">
                      − Costo de fabricar lo vendido
                      <span className="block text-[11px]">Filamento, luz y embalaje de las {salesSummary.units} piezas</span>
                    </dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      −{formatMoney(salesSummary.productionCost, currency)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between gap-2 py-2.5 font-bold">
                    <dt className="text-ink">= Ganancia estimada</dt>
                    <dd className={`tabular-nums ${salesSummary.netProfit >= 0 ? "text-ok" : "text-danger"}`}>
                      {salesSummary.netProfit >= 0 ? "+" : ""}
                      {formatMoney(salesSummary.netProfit, currency)}
                    </dd>
                  </div>
                </dl>

                {(salesSummary.unitsWithoutCost > 0 || salesSummary.unitsEstimatedToday > 0) && (
                  <div className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-[11px] text-ink space-y-0.5">
                    {salesSummary.unitsWithoutCost > 0 && (
                      <p>
                        {salesSummary.unitsWithoutCost}{" "}
                        {salesSummary.unitsWithoutCost === 1 ? "pieza manual no tenía" : "piezas manuales no tenían"}{" "}
                        gramos ni material; su costo quedó en $0 y la ganancia real podría ser menor.
                      </p>
                    )}
                    {salesSummary.unitsEstimatedToday > 0 && (
                      <p className="text-muted">
                        Para {salesSummary.unitsEstimatedToday}{" "}
                        {salesSummary.unitsEstimatedToday === 1 ? "pieza" : "piezas"} sin costo guardado se usaron tus tarifas actuales.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t border-line/60 pt-3 text-xs font-semibold">
            <Link href="/products" className="text-primary hover:underline">
              Ver rendimiento por producto →
            </Link>
            <Link href="/orders" className="text-muted hover:text-ink hover:underline">
              Revisar pedidos del mes →
            </Link>
          </div>
        </Card>

        {/* 2. Flujo de caja en cuenta bancaria */}
        <Card className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                  Flujo de caja en cuenta
                </span>
                <p className="text-xs text-muted mt-0.5">
                  Dinero líquido que entró y salió en {formatMonthLabel(view.month)}
                </p>
              </div>
              <Badge tone={cashAvailable >= 0 ? "ok" : "danger"}>
                {cashAvailable >= 0 ? "Saldo a favor" : "Déficit"}
              </Badge>
            </div>

            <div>
              <span className="text-xs text-muted block">Te quedó disponible en caja</span>
              <span
                className={`mt-0.5 block text-3xl font-bold tracking-tight tabular-nums ${
                  cashAvailable >= 0 ? "text-ok" : "text-danger"
                }`}
              >
                {formatMoney(cashAvailable, currency)}
              </span>
            </div>

            <dl className="divide-y divide-line/60 rounded-xl border border-line/70 bg-canvas/50 px-3.5 py-1 text-sm">
              <div className="flex items-center justify-between gap-2 py-2.5">
                <dt className="text-muted">
                  + Entró a caja
                  <span className="block text-[11px]">
                    {incomeCount} {incomeCount === 1 ? "cobro / ingreso" : "cobros / ingresos"}
                  </span>
                </dt>
                <dd className="font-semibold text-ok tabular-nums">
                  +{formatMoney(grossIncome, currency)}
                </dd>
              </div>

              {vatPercent > 0 && (
                <div className="flex items-center justify-between gap-2 py-2.5">
                  <dt className="text-muted">
                    − IVA apartado ({vatPercent}%)
                    <span className="block text-[11px]">Por pagar a impuestos</span>
                  </dt>
                  <dd className="font-medium text-muted tabular-nums">
                    −{formatMoney(cashVatAmount, currency)}
                  </dd>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 py-2.5">
                <dt className="text-muted">
                  − Salió en compras y gastos
                  <span className="block text-[11px]">
                    {expenseCount} {expenseCount === 1 ? "compra / egreso" : "compras / egresos"}
                  </span>
                </dt>
                <dd className="font-semibold text-ink tabular-nums">
                  −{formatMoney(view.summary.expense, currency)}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-2 py-2.5 font-bold">
                <dt className="text-ink">= Disponible en caja</dt>
                <dd className={`tabular-nums ${cashAvailable >= 0 ? "text-ok" : "text-danger"}`}>
                  {formatMoney(cashAvailable, currency)}
                </dd>
              </div>
            </dl>
          </div>

          <p className="rounded-xl border border-line/60 bg-raised/60 p-3 text-[11px] leading-relaxed text-muted">
            Las compras de bobinas y gastos se restan de tu <strong className="text-ink">Caja</strong> el día que los pagas; los gramos, luz y embalaje de cada venta se descuentan en <strong className="text-ink">Resultado de tus ventas</strong>.
          </p>
        </Card>
      </div>

      {/* Desglose por canal y por categoría con barras proporcionales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              Entradas por canal
            </h2>
            <span className="text-xs font-semibold text-ink tabular-nums">
              {formatMoney(grossIncome, currency)}
            </span>
          </div>
          {incomeChannels.length === 0 ? (
            <p className="text-xs text-muted py-2">Sin ingresos cobrados en este mes.</p>
          ) : (
            <div className="space-y-3">
              {incomeChannels.map(([ch, amt]) => {
                const pct = grossIncome > 0 ? Math.round((amt / grossIncome) * 100) : 0;
                return (
                  <div key={ch} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-ink">
                        {CHANNEL_LABEL[ch as OrderChannel] ?? ch}
                      </span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatMoney(amt, currency)}{" "}
                        <span className="text-xs font-normal text-muted">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                      <div
                        className="h-full rounded-full bg-ok"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted">
              Compras y gastos por categoría
            </h2>
            <span className="text-xs font-semibold text-ink tabular-nums">
              {formatMoney(view.summary.expense, currency)}
            </span>
          </div>
          {expenseCategories.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-raised/40 px-3.5 py-2.5">
              <p className="text-xs text-muted">Sin compras o gastos registrados este mes.</p>
              <button
                type="button"
                onClick={() => openForm("EXPENSE")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                + Registrar gasto
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {expenseCategories.map(([cat, amt]) => {
                const pct =
                  view.summary.expense > 0 ? Math.round((amt / view.summary.expense) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium text-ink">
                        {CATEGORY_LABEL[cat as MoneyCategory] ?? cat}
                      </span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatMoney(amt, currency)}{" "}
                        <span className="text-xs font-normal text-muted">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-raised overflow-hidden">
                      <div
                        className="h-full rounded-full bg-line-strong"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Lista de movimientos del mes con filtro y opción de anular */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-bold text-ink">
            Movimientos de {formatMonthLabel(view.month)} ({visibleTransactions.length})
          </h2>

          {view.transactions.length > 0 && (
            <div className={segmentedTrackClass} role="tablist" aria-label="Filtrar movimientos">
              <button
                type="button"
                onClick={() => setTxFilter("ALL")}
                className={`min-h-8 ${segmentedItemClass(txFilter === "ALL")}`}
              >
                Todos ({view.transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setTxFilter("INCOME")}
                className={`min-h-8 ${segmentedItemClass(txFilter === "INCOME")}`}
              >
                Ingresos ({view.transactions.filter((t) => t.type === "INCOME").length})
              </button>
              <button
                type="button"
                onClick={() => setTxFilter("EXPENSE")}
                className={`min-h-8 ${segmentedItemClass(txFilter === "EXPENSE")}`}
              >
                Gastos ({view.transactions.filter((t) => t.type === "EXPENSE").length})
              </button>
            </div>
          )}
        </div>

        {visibleTransactions.length === 0 ? (
          <EmptyState
            title={
              view.transactions.length === 0
                ? "Todavía no hay movimientos este mes"
                : "No hay movimientos en este filtro"
            }
            description={
              view.transactions.length === 0
                ? "Cada venta cobrada se anota sola aquí. Los gastos (filamento, envíos, repuestos) los agregas con «Registrar gasto»."
                : "Cambia el filtro a «Todos» para ver los demás movimientos del mes."
            }
          />
        ) : (
          <div className="divide-y divide-line/70">
            {visibleTransactions.map((tx) => {
              const isVoided = tx.voidedAt !== null;
              const isVoidingThis = voidingId === tx.id;
              const categoryLabel =
                CATEGORY_LABEL[tx.category as MoneyCategory] ?? tx.category;
              const methodLabel =
                METHOD_LABEL[tx.method as PaymentMethod] ?? tx.method;

              return (
                <div key={tx.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                  <div
                    className={`flex items-start sm:items-center justify-between gap-3 ${
                      isVoided ? "opacity-55" : ""
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isVoided ? "line-through text-muted" : "text-ink"
                          }`}
                        >
                          {categoryLabel}
                        </span>
                        <span className="text-xs text-muted">· {methodLabel}</span>
                        {tx.orderId && tx.orderNumber !== null && (
                          <Link
                            href={`/orders/${tx.orderId}`}
                            className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary hover:underline"
                          >
                            {orderNumberLabel(tx.orderNumber)}
                          </Link>
                        )}
                        {isVoided && <Badge tone="danger">Anulado</Badge>}
                      </div>

                      <div className="text-xs text-muted">
                        <span>{formatDay(tx.occurredOn)}</span>
                        {tx.notes ? <span> · {tx.notes}</span> : null}
                        {isVoided && tx.voidReason ? (
                          <span> · Motivo de anulación: {tx.voidReason}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-sm sm:text-base font-bold tabular-nums ${
                          isVoided
                            ? "line-through text-muted"
                            : tx.type === "EXPENSE"
                              ? "text-ink"
                              : "text-ok"
                        }`}
                      >
                        {tx.type === "EXPENSE" ? "−" : "+"}
                        {formatMoney(tx.amount, currency)}
                      </span>

                      {!isVoided && !isVoidingThis && (
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setMessage(null);
                            setVoidingId(tx.id);
                            setVoidReason("");
                          }}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-raised px-2.5 text-xs font-medium text-muted hover:text-danger hover:border-danger/40 transition-colors touch-manipulation"
                        >
                          Anular
                        </button>
                      )}
                    </div>
                  </div>

                  {isVoidingThis && (
                    <div className="rounded-xl border border-danger/30 bg-danger-soft/20 p-3 space-y-2.5">
                      <label className="block text-xs font-semibold text-danger">
                        Motivo de la anulación (obligatorio) *
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={voidReason}
                        onChange={(e) => setVoidReason(e.target.value)}
                        placeholder="Ej. Monto mal ingresado, gasto duplicado…"
                        disabled={isPending}
                        className={`${inputClass} min-h-10 text-sm`}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setVoidingId(null);
                            setVoidReason("");
                          }}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-canvas touch-manipulation"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleVoid(tx.id)}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg bg-danger px-3 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 touch-manipulation"
                        >
                          {isPending ? "Anulando…" : "Confirmar anulación"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

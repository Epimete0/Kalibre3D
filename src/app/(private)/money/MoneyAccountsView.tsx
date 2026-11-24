"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatDay } from "@/lib/date-labels";
import type {
  MonthlyCostBreakdown,
  MonthlyOrderAccountRow,
  SalesEconomicsSummary,
} from "@/lib/insights";
import { formatMoney } from "@/lib/money-format";
import { CATEGORY_LABEL, type MoneyCategory } from "@/lib/money-presentation";
import { CHANNEL_LABEL, orderNumberLabel } from "@/lib/order-presentation";
import type { OrderChannel } from "@/lib/order-status";

function marginTone(margin: number | null): "ok" | "warn" | "danger" | "neutral" {
  if (margin === null) return "neutral";
  if (margin >= 50) return "ok";
  if (margin >= 25) return "warn";
  return "danger";
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function MoneyAccountsView({
  monthLabel,
  salesSummary,
  costBreakdown,
  orderAccounts,
  expenseTotal,
  expenseCategories,
  currency,
  vatPercent,
  onOpenExpenseForm,
}: {
  monthLabel: string;
  salesSummary: SalesEconomicsSummary;
  costBreakdown: MonthlyCostBreakdown;
  orderAccounts: MonthlyOrderAccountRow[];
  expenseTotal: number;
  expenseCategories: Array<[string, number]>;
  currency: string;
  vatPercent: number;
  onOpenExpenseForm: () => void;
}) {
  const [orderQuery, setOrderQuery] = useState("");

  const salesProfitShare =
    salesSummary.grossRevenue > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((Math.max(0, salesSummary.netProfit) / salesSummary.grossRevenue) * 100)
          )
        )
      : 0;
  const salesVatShare =
    salesSummary.grossRevenue > 0 && salesSummary.vatAmount > 0
      ? Math.max(
          0,
          Math.min(
            100 - salesProfitShare,
            Math.round((salesSummary.vatAmount / salesSummary.grossRevenue) * 100)
          )
        )
      : 0;
  const salesCostShare =
    salesSummary.grossRevenue > 0
      ? Math.max(0, 100 - salesProfitShare - salesVatShare)
      : 0;

  const productionCostItems = useMemo(() => {
    const items: Array<{ key: string; label: string; amount: number; helper: string }> = [
      {
        key: "material",
        label: "Filamento y purga",
        amount: costBreakdown.materialCost,
        helper: "Plástico consumido por las piezas vendidas",
      },
      {
        key: "electricity",
        label: "Electricidad",
        amount: costBreakdown.electricityCost,
        helper: "Consumo según horas de impresión",
      },
      {
        key: "wear",
        label: "Desgaste y margen de fallos",
        amount: costBreakdown.wearAndFailureCost,
        helper: "Reposición de impresora y merma configurada",
      },
      {
        key: "packaging",
        label: "Embalaje e insumos extra",
        amount: costBreakdown.packagingAndSuppliesCost,
        helper: "Bolsas, cajas, argollas, imanes o tornillos",
      },
    ];
    if (costBreakdown.otherStoredCost > 0) {
      items.push({
        key: "other",
        label: "Otros costos guardados",
        amount: costBreakdown.otherStoredCost,
        helper: "Ventas con costo registrado sin ficha técnica detallada",
      });
    }
    return items.filter((item) => item.amount > 0);
  }, [costBreakdown]);

  const filteredOrderAccounts = useMemo(() => {
    const q = normalizeSearch(orderQuery);
    if (!q) return orderAccounts;
    const numQ = q.startsWith("#") ? q.slice(1).trim() : q;
    return orderAccounts.filter((row) => {
      if (numQ && String(row.number).includes(numQ)) return true;
      if (row.customerName && normalizeSearch(row.customerName).includes(q)) return true;
      if (normalizeSearch(row.itemsSummary).includes(q)) return true;
      if (normalizeSearch(CHANNEL_LABEL[row.channel] ?? row.channel).includes(q)) return true;
      return false;
    });
  }, [orderAccounts, orderQuery]);

  const filteredTotals = useMemo(
    () =>
      filteredOrderAccounts.reduce(
        (acc, row) => ({
          units: acc.units + row.units,
          grossRevenue: acc.grossRevenue + row.grossRevenue,
          vatAmount: acc.vatAmount + row.vatAmount,
          productionCost: acc.productionCost + row.productionCost,
          profit: acc.profit + row.profit,
        }),
        { units: 0, grossRevenue: 0, vatAmount: 0, productionCost: 0, profit: 0 }
      ),
    [filteredOrderAccounts]
  );

  return (
    <div className="space-y-4">
      {/* 1. Cuatro tarjetas clave: Ventas, Costos, IVA y Utilidad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Ventas del mes
            </span>
          </div>
          <div>
            <span className="block text-2xl sm:text-[28px] font-bold tracking-tight text-ink tabular-nums">
              {formatMoney(salesSummary.grossRevenue, currency)}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {salesSummary.ordersCount}{" "}
              {salesSummary.ordersCount === 1 ? "pedido" : "pedidos"} · {salesSummary.units}{" "}
              {salesSummary.units === 1 ? "pieza" : "piezas"}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Costos de fabricar
            </span>
            {salesSummary.grossRevenue > 0 && (
              <span className="text-[11px] font-semibold text-muted tabular-nums">
                {salesCostShare}%
              </span>
            )}
          </div>
          <div>
            <span className="block text-2xl sm:text-[28px] font-bold tracking-tight text-ink tabular-nums">
              {formatMoney(salesSummary.productionCost, currency)}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {expenseTotal > 0
                ? `Compras/gastos en caja: ${formatMoney(expenseTotal, currency)}`
                : "Filamento, luz, desgaste y embalaje"}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              IVA ({vatPercent}%)
            </span>
            {vatPercent > 0 && salesSummary.grossRevenue > 0 && (
              <span className="text-[11px] font-semibold text-muted tabular-nums">
                {salesVatShare}%
              </span>
            )}
          </div>
          <div>
            <span className="block text-2xl sm:text-[28px] font-bold tracking-tight text-ink tabular-nums">
              {formatMoney(salesSummary.vatAmount, currency)}
            </span>
            {vatPercent > 0 ? (
              <span className="mt-0.5 block text-xs text-muted tabular-nums">
                A apartar · Neto taller: {formatMoney(salesSummary.netRevenue, currency)}
              </span>
            ) : (
              <Link
                href="/settings"
                className="mt-0.5 inline-block text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
              >
                IVA en 0% · Configurar en Mis costos
              </Link>
            )}
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between gap-2 border-line-strong/60">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Utilidad estimada
            </span>
            {salesSummary.marginPercent !== null && (
              <Badge tone={marginTone(salesSummary.marginPercent)}>
                {salesSummary.marginPercent}% margen
              </Badge>
            )}
          </div>
          <div>
            <span
              className={`block text-2xl sm:text-[28px] font-bold tracking-tight tabular-nums ${
                salesSummary.netProfit >= 0 ? "text-ok" : "text-danger"
              }`}
            >
              {salesSummary.netProfit >= 0 ? "+" : ""}
              {formatMoney(salesSummary.netProfit, currency)}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {vatPercent > 0 ? "Limpio tras IVA y costos" : "Limpio tras costos de fabricar"}
            </span>
          </div>
        </Card>
      </div>

      {/* 2. Fórmula visual paso a paso */}
      <Card className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink">Cómo se reparten tus ventas</h2>
            <p className="text-xs text-muted">
              Neto de descuentos y comisiones de Mercado Libre.
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-semibold text-muted hover:text-ink hover:underline"
          >
            Ver rendimiento por pieza →
          </Link>
        </div>

        {salesSummary.ordersCount === 0 ? (
          <div className="rounded-xl border border-line/70 bg-raised/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-ink">
                Todavía no hay ventas confirmadas en {monthLabel}.
              </p>
              <p className="text-xs text-muted">
                Cuando registres ventas, aquí verás automáticamente cuánto es costo, cuánto es IVA y cuánto es utilidad.
              </p>
            </div>
            <Link
              href="/orders/new"
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-white hover:bg-primary-hover transition-colors"
            >
              + Registrar venta
            </Link>
          </div>
        ) : (
          <>
            {salesSummary.grossRevenue > 0 && (
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-raised overflow-hidden flex">
                  {salesProfitShare > 0 && (
                    <div
                      className="h-full bg-ok transition-[width] duration-200 ease-out"
                      style={{ width: `${salesProfitShare}%` }}
                      title={`Utilidad ${salesProfitShare}%`}
                    />
                  )}
                  {salesCostShare > 0 && (
                    <div
                      className="h-full bg-primary transition-[width] duration-200 ease-out"
                      style={{ width: `${salesCostShare}%` }}
                      title={`Costos ${salesCostShare}%`}
                    />
                  )}
                  {salesVatShare > 0 && (
                    <div
                      className="h-full bg-line-strong transition-[width] duration-200 ease-out"
                      style={{ width: `${salesVatShare}%` }}
                      title={`IVA ${salesVatShare}%`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-ok" aria-hidden="true" />
                    Utilidad: <strong className="text-ink tabular-nums">{salesProfitShare}%</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    Costos: <strong className="text-ink tabular-nums">{salesCostShare}%</strong>
                  </span>
                  {salesVatShare > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-line-strong" aria-hidden="true" />
                      IVA: <strong className="text-ink tabular-nums">{salesVatShare}%</strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Fórmula lineal en bloques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 rounded-xl border border-line/70 bg-canvas/60 p-3 text-xs">
              <div className="rounded-lg bg-surface px-3 py-2 border border-line/60">
                <span className="block text-[11px] text-muted">Ventas</span>
                <span className="mt-0.5 block text-sm font-bold text-ink tabular-nums">
                  {formatMoney(salesSummary.grossRevenue, currency)}
                </span>
              </div>
              <div className="rounded-lg bg-surface px-3 py-2 border border-line/60">
                <span className="block text-[11px] text-muted">
                  − IVA ({vatPercent}%)
                </span>
                <span className="mt-0.5 block text-sm font-bold text-ink tabular-nums">
                  −{formatMoney(salesSummary.vatAmount, currency)}
                </span>
              </div>
              <div className="rounded-lg bg-surface px-3 py-2 border border-line/60">
                <span className="block text-[11px] text-muted">− Costos</span>
                <span className="mt-0.5 block text-sm font-bold text-ink tabular-nums">
                  −{formatMoney(salesSummary.productionCost, currency)}
                </span>
              </div>
              <div className="rounded-lg bg-surface px-3 py-2 border border-line/60">
                <span className="block text-[11px] text-muted">= Utilidad estimada</span>
                <span
                  className={`mt-0.5 block text-sm font-bold tabular-nums ${
                    salesSummary.netProfit >= 0 ? "text-ok" : "text-danger"
                  }`}
                >
                  {salesSummary.netProfit >= 0 ? "+" : ""}
                  {formatMoney(salesSummary.netProfit, currency)}
                </span>
              </div>
            </div>

            {(salesSummary.unitsWithoutCost > 0 || salesSummary.unitsEstimatedToday > 0) && (
              <div className="rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-ink space-y-0.5">
                {salesSummary.unitsWithoutCost > 0 && (
                  <p>
                    {salesSummary.unitsWithoutCost}{" "}
                    {salesSummary.unitsWithoutCost === 1
                      ? "pieza manual no tenía"
                      : "piezas manuales no tenían"}{" "}
                    gramos ni material; su costo quedó en $0 y la utilidad real podría ser menor.
                  </p>
                )}
                {salesSummary.unitsEstimatedToday > 0 && (
                  <p className="text-muted">
                    Para {salesSummary.unitsEstimatedToday}{" "}
                    {salesSummary.unitsEstimatedToday === 1 ? "pieza" : "piezas"} sin costo guardado al vender se usaron tus tarifas actuales.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {/* 3. Desglose claro de costos: Fabricación vs Gastos registrados en caja */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                Desglose del costo de fabricar
              </h2>
              <span className="text-xs font-bold text-ink tabular-nums">
                {formatMoney(costBreakdown.totalCost, currency)}
              </span>
            </div>

            {productionCostItems.length === 0 ? (
              <p className="text-xs text-muted py-1">
                Sin costos de fabricación calculados en {monthLabel}.
              </p>
            ) : (
              <div className="space-y-2.5">
                {productionCostItems.map((item) => {
                  const pct =
                    costBreakdown.totalCost > 0
                      ? Math.round((item.amount / costBreakdown.totalCost) * 100)
                      : 0;
                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs sm:text-sm">
                        <div className="min-w-0">
                          <span className="font-medium text-ink">{item.label}</span>
                          <span className="hidden sm:inline text-[11px] text-muted">
                            {" "}· {item.helper}
                          </span>
                        </div>
                        <span className="font-semibold text-ink tabular-nums shrink-0">
                          {formatMoney(item.amount, currency)}{" "}
                          <span className="text-xs font-normal text-muted">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="rounded-xl border border-line/60 bg-raised/50 px-3 py-2 text-[11px] leading-snug text-muted">
            Corresponde únicamente al material, luz, desgaste y embalaje consumidos por las piezas vendidas en {monthLabel}.
          </p>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
                Compras y gastos pagados este mes
              </h2>
              <span className="text-xs font-bold text-ink tabular-nums">
                {formatMoney(expenseTotal, currency)}
              </span>
            </div>

            {expenseCategories.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/60 bg-raised/40 px-3 py-2.5">
                <p className="text-xs text-muted">Sin compras o gastos registrados este mes.</p>
                <button
                  type="button"
                  onClick={onOpenExpenseForm}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  + Registrar gasto
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expenseCategories.map(([cat, amt]) => {
                  const pct = expenseTotal > 0 ? Math.round((amt / expenseTotal) * 100) : 0;
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
                      <div className="h-1.5 w-full rounded-full bg-raised overflow-hidden">
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
          </div>

          <p className="rounded-xl border border-line/60 bg-raised/50 px-3 py-2 text-[11px] leading-snug text-muted">
            Es el dinero que salió de tu cuenta al comprar bobinas o pagar gastos; no se resta dos veces de la utilidad de tus ventas.
          </p>
        </Card>
      </div>

      {/* 4. Detalle por pedido del mes */}
      <Card className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <h2 className="text-base font-bold text-ink">
              Detalle por pedido ({filteredOrderAccounts.length})
            </h2>
            <p className="text-xs text-muted">
              Revisa cuánto dejó cada pedido confirmado o entregado de {monthLabel}.
            </p>
          </div>

          {orderAccounts.length > 0 && (
            <input
              type="search"
              value={orderQuery}
              onChange={(e) => setOrderQuery(e.target.value)}
              placeholder="Buscar #pedido, cliente o pieza…"
              aria-label="Buscar en el detalle de pedidos del mes"
              className="min-h-9 w-full sm:w-60 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>

        {filteredOrderAccounts.length === 0 ? (
          <EmptyState
            title={
              orderAccounts.length === 0
                ? "Sin pedidos vendidos este mes"
                : "Ningún pedido coincide con la búsqueda"
            }
            description={
              orderAccounts.length === 0
                ? "Los pedidos confirmados, en impresión, listos o entregados aparecerán aquí con su costo, IVA y utilidad."
                : "Prueba con otro número de pedido, nombre de cliente o pieza."
            }
          />
        ) : (
          <>
            {/* Móvil: tarjetas compactas por pedido */}
            <div className="space-y-2.5 md:hidden">
              {filteredOrderAccounts.map((row) => (
                <Link
                  key={row.id}
                  href={`/orders/${row.id}`}
                  className="block rounded-xl border border-line bg-canvas/40 p-3.5 hover:border-line-strong transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-ink">
                          {orderNumberLabel(row.number)}
                        </span>
                        <span className="text-xs text-muted">· {formatDay(row.createdOn)}</span>
                        {row.unitsWithoutCost > 0 && (
                          <Badge tone="warn">Sin costo completo</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {row.customerName ?? "Sin cliente"} ·{" "}
                        {CHANNEL_LABEL[row.channel as OrderChannel] ?? row.channel}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-ink">{row.itemsSummary}</p>
                    </div>
                    {row.marginPercent !== null && (
                      <Badge tone={marginTone(row.marginPercent)}>{row.marginPercent}%</Badge>
                    )}
                  </div>

                  <div
                    className={`mt-3 grid gap-2 border-t border-line/60 pt-2.5 text-xs tabular-nums ${
                      vatPercent > 0 ? "grid-cols-4" : "grid-cols-3"
                    }`}
                  >
                    <div>
                      <span className="block text-[10px] text-muted">Venta</span>
                      <span className="font-semibold text-ink">
                        {formatMoney(row.grossRevenue, currency)}
                      </span>
                    </div>
                    {vatPercent > 0 && (
                      <div>
                        <span className="block text-[10px] text-muted">IVA</span>
                        <span className="font-medium text-muted">
                          −{formatMoney(row.vatAmount, currency)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="block text-[10px] text-muted">Costo</span>
                      <span className="font-medium text-ink">
                        −{formatMoney(row.productionCost, currency)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-muted">Utilidad</span>
                      <span
                        className={`font-bold ${row.profit >= 0 ? "text-ok" : "text-danger"}`}
                      >
                        {row.profit >= 0 ? "+" : ""}
                        {formatMoney(row.profit, currency)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Escritorio: tabla limpia con totales al pie */}
            <div className="hidden md:block overflow-x-auto -mx-5 px-5">
              <table className="w-full text-left text-sm">
                <thead className="border-y border-line bg-canvas/70 text-xs font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-2.5">Pedido</th>
                    <th className="px-3 py-2.5">Fecha</th>
                    <th className="px-3 py-2.5">Cliente y piezas</th>
                    <th className="px-3 py-2.5 text-right">Venta</th>
                    {vatPercent > 0 && <th className="px-3 py-2.5 text-right">IVA</th>}
                    <th className="px-3 py-2.5 text-right">Costo</th>
                    <th className="px-3 py-2.5 text-right">Utilidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {filteredOrderAccounts.map((row) => (
                    <tr key={row.id} className="hover:bg-canvas/40 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link
                          href={`/orders/${row.id}`}
                          className="font-bold text-ink hover:text-primary"
                        >
                          {orderNumberLabel(row.number)}
                        </Link>
                        <span className="block text-[11px] text-muted">
                          {CHANNEL_LABEL[row.channel as OrderChannel] ?? row.channel}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-muted">
                        {formatDay(row.createdOn)}
                      </td>
                      <td className="px-3 py-3 max-w-sm">
                        <div className="font-medium text-ink truncate">
                          {row.customerName ?? <span className="text-muted">Sin cliente</span>}
                        </div>
                        <p className="truncate text-xs text-muted" title={row.itemsSummary}>
                          {row.itemsSummary}
                        </p>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right font-semibold text-ink tabular-nums">
                        {formatMoney(row.grossRevenue, currency)}
                      </td>
                      {vatPercent > 0 && (
                        <td className="px-3 py-3 whitespace-nowrap text-right text-xs text-muted tabular-nums">
                          −{formatMoney(row.vatAmount, currency)}
                        </td>
                      )}
                      <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                        <span className="font-medium text-ink">
                          −{formatMoney(row.productionCost, currency)}
                        </span>
                        {row.unitsWithoutCost > 0 && (
                          <span className="block text-[10px] font-semibold text-warn">
                            Incompleto
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right tabular-nums">
                        <span
                          className={`font-bold ${row.profit >= 0 ? "text-ok" : "text-danger"}`}
                        >
                          {row.profit >= 0 ? "+" : ""}
                          {formatMoney(row.profit, currency)}
                        </span>
                        {row.marginPercent !== null && (
                          <span className="block text-[11px] text-muted">
                            {row.marginPercent}% margen
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-line bg-canvas/80 text-xs font-bold text-ink">
                  <tr>
                    <td className="px-3 py-3" colSpan={3}>
                      Total ({filteredOrderAccounts.length}{" "}
                      {filteredOrderAccounts.length === 1 ? "pedido" : "pedidos"} ·{" "}
                      {filteredTotals.units} {filteredTotals.units === 1 ? "pieza" : "piezas"})
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatMoney(filteredTotals.grossRevenue, currency)}
                    </td>
                    {vatPercent > 0 && (
                      <td className="px-3 py-3 text-right text-muted tabular-nums">
                        −{formatMoney(filteredTotals.vatAmount, currency)}
                      </td>
                    )}
                    <td className="px-3 py-3 text-right tabular-nums">
                      −{formatMoney(filteredTotals.productionCost, currency)}
                    </td>
                    <td
                      className={`px-3 py-3 text-right tabular-nums ${
                        filteredTotals.profit >= 0 ? "text-ok" : "text-danger"
                      }`}
                    >
                      {filteredTotals.profit >= 0 ? "+" : ""}
                      {formatMoney(filteredTotals.profit, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

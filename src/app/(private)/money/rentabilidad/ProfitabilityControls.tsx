"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, inputClass } from "@/components/ui";
import { vatIncluded } from "@/lib/costing";
import type { ProductProfitability } from "@/lib/insights";
import { formatMoney } from "@/lib/money-format";

export type ProfitabilityControlsProps = {
  rows: ProductProfitability[];
  totals: {
    revenue: number;
    cost: number;
    profit: number;
    units: number;
  };
  ordersCount: number;
  currency: string;
  vatPercent: number;
  anyEstimatedToday: boolean;
  anyWithoutCost: boolean;
};

type SortOption = "profit" | "margin" | "units" | "low-margin";

function marginTone(margin: number | null): "ok" | "warn" | "danger" | "neutral" {
  if (margin === null) return "neutral";
  if (margin >= 50) return "ok";
  if (margin >= 25) return "warn";
  return "danger";
}

export function ProfitabilityControls({
  rows,
  totals,
  ordersCount,
  currency,
  vatPercent,
  anyEstimatedToday,
  anyWithoutCost,
}: ProfitabilityControlsProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("profit");

  // Cálculos impositivos globales
  const vatAmount = vatIncluded(totals.revenue, vatPercent);
  const netRevenue = totals.revenue - vatAmount;
  const netProfit = vatPercent > 0 ? netRevenue - totals.cost : totals.profit;
  const globalMargin =
    netRevenue > 0 ? Math.round((netProfit / netRevenue) * 100) : 0;

  // Piezas destacadas para Insights rápidos
  const { topProfitPiece, topVolumePiece, topMarginPiece } = useMemo(() => {
    if (rows.length === 0) {
      return { topProfitPiece: null, topVolumePiece: null, topMarginPiece: null };
    }
    const byProfit = [...rows].sort((a, b) => b.profit - a.profit);
    const byVolume = [...rows].sort((a, b) => b.units - a.units);
    const byMargin = [...rows]
      .filter((r) => r.marginPercent !== null && r.units > 0)
      .sort((a, b) => (b.marginPercent ?? 0) - (a.marginPercent ?? 0));

    return {
      topProfitPiece: byProfit[0] && byProfit[0].profit > 0 ? byProfit[0] : null,
      topVolumePiece: byVolume[0] && byVolume[0].units > 0 ? byVolume[0] : null,
      topMarginPiece: byMargin[0] && (byMargin[0].marginPercent ?? 0) > 0 ? byMargin[0] : null,
    };
  }, [rows]);

  // Filtrado y ordenamiento de la lista
  const filteredRows = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "profit":
          return b.profit - a.profit;
        case "margin":
          return (b.marginPercent ?? -999) - (a.marginPercent ?? -999);
        case "units":
          return b.units - a.units;
        case "low-margin":
          return (a.marginPercent ?? 999) - (b.marginPercent ?? 999);
        default:
          return 0;
      }
    });
  }, [rows, search, sortBy]);

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de salud financiera y KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Ingresos generados
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ok">
              {formatMoney(totals.revenue, currency)}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted">
            {vatPercent > 0 ? (
              <span>
                Neto taller: <strong className="text-ink font-semibold">{formatMoney(netRevenue, currency)}</strong>
                {" · "}IVA {vatPercent}% ({formatMoney(vatAmount, currency)})
              </span>
            ) : (
              <span>{ordersCount} {ordersCount === 1 ? "pedido concretado" : "pedidos concretados"}</span>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Costo de fabricación
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
              {formatMoney(totals.cost, currency)}
            </span>
          </div>
          <span className="mt-2 block text-xs text-muted">
            Filamento, luz, embalaje y purga
          </span>
        </Card>

        <Card className="p-4 sm:p-5 border-primary/25 bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                Ganancia neta real
              </span>
              <Badge tone={globalMargin >= 50 ? "ok" : globalMargin >= 25 ? "warn" : "danger"}>
                {globalMargin}% margen
              </Badge>
            </div>
            <span
              className={`mt-1 block text-2xl font-bold tabular-nums ${
                netProfit >= 0 ? "text-ok" : "text-danger"
              }`}
            >
              {formatMoney(netProfit, currency)}
            </span>
          </div>
          <span className="mt-2 block text-xs text-muted">
            {vatPercent > 0
              ? "Descontando IVA y costos directos"
              : "Ventas menos costos de fabricación"}
          </span>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Volumen producido
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
              {totals.units} {totals.units === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <span className="mt-2 block text-xs text-muted">
            {rows.length} {rows.length === 1 ? "modelo distinto" : "modelos distintos"} vendidos
          </span>
        </Card>
      </div>

      {/* 2. Destacados del taller (Highlights técnicos sin emojis) */}
      {(topProfitPiece || topVolumePiece || topMarginPiece) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {topProfitPiece && (
            <div className="rounded-xl border border-line bg-surface p-3.5 flex items-start gap-3">
              <div className="rounded-lg bg-ok-soft p-2 text-ok shrink-0" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Mayor ganancia total
                </span>
                <p className="text-sm font-bold text-ink truncate mt-0.5">
                  {topProfitPiece.name}
                </p>
                <p className="text-xs text-ok font-semibold tabular-nums mt-0.5">
                  +{formatMoney(topProfitPiece.profit, currency)}
                  <span className="text-muted font-normal"> · {topProfitPiece.units} u.</span>
                </p>
              </div>
            </div>
          )}

          {topVolumePiece && (
            <div className="rounded-xl border border-line bg-surface p-3.5 flex items-start gap-3">
              <div className="rounded-lg bg-accent-soft p-2 text-accent shrink-0" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Más vendida en volumen
                </span>
                <p className="text-sm font-bold text-ink truncate mt-0.5">
                  {topVolumePiece.name}
                </p>
                <p className="text-xs text-ink font-semibold tabular-nums mt-0.5">
                  {topVolumePiece.units} unidades
                  <span className="text-muted font-normal"> · {formatMoney(topVolumePiece.revenue, currency)}</span>
                </p>
              </div>
            </div>
          )}

          {topMarginPiece && (
            <div className="rounded-xl border border-line bg-surface p-3.5 flex items-start gap-3">
              <div className="rounded-lg bg-raised p-2 text-ink shrink-0" aria-hidden="true">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Mayor margen porcentual
                </span>
                <p className="text-sm font-bold text-ink truncate mt-0.5">
                  {topMarginPiece.name}
                </p>
                <p className="text-xs text-ink font-semibold tabular-nums mt-0.5">
                  {topMarginPiece.marginPercent}% de margen
                  <span className="text-muted font-normal"> · {topMarginPiece.units} u.</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Barra de búsqueda y ordenamiento */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pieza..."
            className={`${inputClass} min-h-10 text-sm pl-9`}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setSortBy("profit")}
            className={`min-h-9 px-3 shrink-0 rounded-lg text-xs font-semibold transition-colors ${
              sortBy === "profit"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-canvas"
            }`}
          >
            Mayor ganancia
          </button>
          <button
            type="button"
            onClick={() => setSortBy("margin")}
            className={`min-h-9 px-3 shrink-0 rounded-lg text-xs font-semibold transition-colors ${
              sortBy === "margin"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-canvas"
            }`}
          >
            Mayor margen
          </button>
          <button
            type="button"
            onClick={() => setSortBy("units")}
            className={`min-h-9 px-3 shrink-0 rounded-lg text-xs font-semibold transition-colors ${
              sortBy === "units"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-canvas"
            }`}
          >
            Más vendidas
          </button>
          <button
            type="button"
            onClick={() => setSortBy("low-margin")}
            className={`min-h-9 px-3 shrink-0 rounded-lg text-xs font-semibold transition-colors ${
              sortBy === "low-margin"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-ink hover:bg-canvas"
            }`}
          >
            Menor margen
          </button>
        </div>
      </div>

      {/* 4. Lista detallada de piezas */}
      {filteredRows.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <p className="text-sm font-semibold text-ink">No se encontraron piezas con ese nombre.</p>
          <p className="text-xs text-muted">Prueba con otro término o borra la búsqueda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row, index) => {
            const unitProfit = row.units > 0 ? Math.round(row.profit / row.units) : 0;
            const unitCost = row.units > 0 ? Math.round(row.cost / row.units) : 0;
            const unitPrice = row.units > 0 ? Math.round(row.revenue / row.units) : 0;

            const profitShare =
              totals.profit > 0
                ? Math.round((Math.max(0, row.profit) / totals.profit) * 100)
                : 0;

            // Proporción visual costo vs ganancia (sobre el precio de venta unitario)
            const profitPct =
              row.revenue > 0
                ? Math.max(0, Math.min(100, Math.round((row.profit / row.revenue) * 100)))
                : 0;
            const costPct = Math.max(0, 100 - profitPct);

            return (
              <Card key={row.key} className="p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-raised px-1.5 text-xs font-bold text-muted tabular-nums">
                        #{index + 1}
                      </span>
                      <h2 className="text-base font-bold text-ink truncate">
                        {row.productId ? (
                          <Link
                            href={`/products/${row.productId}`}
                            className="hover:text-primary transition-colors hover:underline"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <span>{row.name}</span>
                        )}
                      </h2>
                      {row.marginPercent !== null && (
                        <Badge tone={marginTone(row.marginPercent)}>
                          {row.marginPercent}% margen
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted">
                      <span className="font-semibold text-ink">{row.units} {row.units === 1 ? "unidad" : "unidades"}</span>
                      {" · "}
                      Precio prom: <span className="text-ink font-medium">{formatMoney(unitPrice, currency)}</span>
                      {" · "}
                      Costo prom: <span className="text-ink font-medium">{formatMoney(unitCost, currency)}</span>
                      {" · "}
                      Ganancia/u: <span className="text-ok font-semibold">+{formatMoney(unitProfit, currency)}</span>
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-xs uppercase tracking-wider text-muted block">
                      Ganancia total
                    </span>
                    <span className="text-xl sm:text-2xl font-bold tabular-nums text-ok">
                      {formatMoney(row.profit, currency)}
                    </span>
                    {totals.profit > 0 && (
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {profitShare}% del total del taller
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de proporción visual Ganancia vs Costo */}
                <div className="space-y-1 pt-1">
                  <div className="h-2 w-full rounded-full bg-raised overflow-hidden flex">
                    <div
                      className="bg-ok h-full transition-all duration-300"
                      style={{ width: `${profitPct}%` }}
                      title={`Ganancia ${profitPct}%`}
                    />
                    <div
                      className="bg-line h-full transition-all duration-300"
                      style={{ width: `${costPct}%` }}
                      title={`Costo ${costPct}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>
                      Ganancia: <strong className="text-ink font-semibold">{profitPct}%</strong> ({formatMoney(row.profit, currency)})
                    </span>
                    <span>
                      Costo: <strong className="text-ink font-semibold">{costPct}%</strong> ({formatMoney(row.cost, currency)})
                    </span>
                  </div>
                </div>

                {/* Avisos si faltó costo o se estimó hoy */}
                {(row.unitsWithoutCost > 0 || row.unitsEstimatedToday > 0) && (
                  <div className="rounded-lg bg-canvas border border-line/60 px-3 py-2 text-[11px] text-muted space-y-0.5">
                    {row.unitsWithoutCost > 0 && (
                      <p className="text-warn">
                        {row.unitsWithoutCost} {row.unitsWithoutCost === 1 ? "unidad sin costo calculado" : "unidades sin costo calculado"} (sin gramos o material en catálogo). Su ganancia real podría ser menor.
                      </p>
                    )}
                    {row.unitsEstimatedToday > 0 && (
                      <p>
                        {row.unitsEstimatedToday} {row.unitsEstimatedToday === 1 ? "unidad calculada" : "unidades calculadas"} con tarifas de hoy porque el pedido no guardó el costo histórico.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* 5. Tarjeta explicativa con reglas claras de cálculo */}
      <Card className="space-y-2 p-4 sm:p-5 text-xs text-muted">
        <h3 className="font-bold uppercase tracking-wider text-ink text-[11px]">
          Cómo se calcula la rentabilidad
        </h3>
        <p>
          <strong className="text-ink">Ingresos netos:</strong> Precio de venta cobrado al cliente menos comisiones de Mercado Libre, costos de envío bonificados y descuentos aplicados.
        </p>
        <p>
          <strong className="text-ink">Costo de fabricación:</strong> Consumo exacto de filamento (incluyendo purga si es multicolor), tiempo de máquina valorizado según tu tarifa eléctrica y costo de embalaje fijados en tu configuración.
        </p>
        {vatPercent > 0 && (
          <p>
            <strong className="text-ink">Tratamiento de IVA ({vatPercent}%):</strong> El IVA se separa automáticamente de los ingresos brutos cobrados para no distorsionar tu rentabilidad real con obligaciones tributarias.
          </p>
        )}
        {anyEstimatedToday && (
          <p>
            Algunas ventas antiguas no tenían congelado su costo al registrarse; el sistema las estima con tus tarifas actuales de «Mis costos».
          </p>
        )}
        {anyWithoutCost && (
          <p>
            Para asegurar que cada venta tenga su costo automático exacto, asocia tus pedidos a productos registrados en tu catálogo.
          </p>
        )}
      </Card>
    </div>
  );
}

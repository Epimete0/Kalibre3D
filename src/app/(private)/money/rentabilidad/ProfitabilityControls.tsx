"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  Card,
  inputClass,
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui";
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
  const pieceProfit = totals.profit;
  const globalMargin =
    totals.revenue > 0 ? Math.round((pieceProfit / totals.revenue) * 100) : 0;

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
      {/* Aviso contextual: aclara la diferencia con Caja */}
      <div className="rounded-xl border border-line bg-raised/50 p-3.5 text-xs text-muted flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <p>
          <strong className="text-ink font-semibold">Margen directo de producción:</strong> Mide cuánto le ganas a cada pieza sobre su filamento y luz consumidos. Para ver el dinero líquido que te quedó en la cuenta bancaria tras compras de bobinas y gastos del mes, revisa{" "}
          <Link href="/money" className="text-primary font-semibold hover:underline">
            Caja del mes →
          </Link>
        </p>
      </div>

      {anyWithoutCost && (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs text-ink">
          Hay piezas vendidas cuyo costo no se pudo calcular porque no tenían gramos o material en catálogo. Su margen real podría variar.
        </div>
      )}

      {anyEstimatedToday && (
        <div className="rounded-xl border border-line bg-raised/60 p-3 text-xs text-muted">
          Algunos pedidos antiguos no tenían el costo histórico guardado; su margen se calculó con los costos de filamento actuales.
        </div>
      )}

      {/* 1. Tarjetas de margen de fabricación */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Ventas de piezas
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
              {formatMoney(totals.revenue, currency)}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted">
            <span>{ordersCount} {ordersCount === 1 ? "pedido entregado" : "pedidos entregados"}</span>
            {vatPercent > 0 && (
              <span className="block mt-0.5">
                Neto sin IVA: <strong className="text-ink font-semibold">{formatMoney(netRevenue, currency)}</strong>
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Costo de filamento y luz
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
              {formatMoney(totals.cost, currency)}
            </span>
          </div>
          <span className="mt-2 block text-xs text-muted">
            Material y energía en piezas vendidas
          </span>
        </Card>

        <Card className="p-4 sm:p-5 border-primary/25 bg-surface flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
                Margen de piezas
              </span>
              <Badge tone={globalMargin >= 50 ? "ok" : globalMargin >= 25 ? "warn" : "danger"}>
                {globalMargin}% retorno
              </Badge>
            </div>
            <span
              className={`mt-1 block text-2xl font-bold tabular-nums ${
                pieceProfit >= 0 ? "text-ok" : "text-danger"
              }`}
            >
              {formatMoney(pieceProfit, currency)}
            </span>
          </div>
          <span className="mt-2 block text-xs text-muted">
            Precio de venta menos costo directo de hacerlas
          </span>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Unidades fabricadas
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-ink">
              {totals.units} {totals.units === 1 ? "unidad" : "unidades"}
            </span>
          </div>
          <span className="mt-2 block text-xs text-muted">
            {rows.length} {rows.length === 1 ? "modelo distinto" : "modelos distintos"}
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
                  Mayor margen total ($)
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
                  Mayor retorno porcentual
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

        <div className={`overflow-x-auto ${segmentedTrackClass}`}>
          <button
            type="button"
            onClick={() => setSortBy("profit")}
            className={`min-h-9 shrink-0 ${segmentedItemClass(sortBy === "profit")}`}
          >
            Mayor margen ($)
          </button>
          <button
            type="button"
            onClick={() => setSortBy("margin")}
            className={`min-h-9 shrink-0 ${segmentedItemClass(sortBy === "margin")}`}
          >
            Mayor retorno (%)
          </button>
          <button
            type="button"
            onClick={() => setSortBy("units")}
            className={`min-h-9 shrink-0 ${segmentedItemClass(sortBy === "units")}`}
          >
            Más vendidas
          </button>
          <button
            type="button"
            onClick={() => setSortBy("low-margin")}
            className={`min-h-9 shrink-0 ${segmentedItemClass(sortBy === "low-margin")}`}
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

            // Proporción visual costo vs ganancia
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
                          {row.marginPercent}% retorno
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
                      Margen/u: <span className="text-ok font-semibold">+{formatMoney(unitProfit, currency)}</span>
                    </p>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-xs uppercase tracking-wider text-muted block">
                      Margen total
                    </span>
                    <span className="text-xl sm:text-2xl font-bold tabular-nums text-ok">
                      +{formatMoney(row.profit, currency)}
                    </span>
                    {totals.profit > 0 && (
                      <span className="mt-0.5 block text-[11px] text-muted">
                        {profitShare}% del margen de piezas del taller
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de proporción visual Margen vs Costo */}
                <div className="space-y-1 pt-1">
                  <div className="h-2 w-full rounded-full bg-raised overflow-hidden flex">
                    <div
                      className="bg-ok h-full transition-all duration-300"
                      style={{ width: `${profitPct}%` }}
                      title={`Margen ${profitPct}%`}
                    />
                    <div
                      className="bg-line h-full transition-all duration-300"
                      style={{ width: `${costPct}%` }}
                      title={`Costo ${costPct}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>
                      Margen: <strong className="text-ink font-semibold">{profitPct}%</strong> ({formatMoney(row.profit, currency)})
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
                        {row.unitsWithoutCost} {row.unitsWithoutCost === 1 ? "unidad sin costo calculado" : "unidades sin costo calculado"} (sin gramos o material en catálogo). Su margen real podría variar.
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

      {/* 5. Tarjeta explicativa con reglas claras y directas */}
      <Card className="space-y-2 p-4 sm:p-5 text-xs text-muted">
        <h3 className="font-bold uppercase tracking-wider text-ink text-[11px]">
          Diferencia entre Margen por pieza y Caja del mes
        </h3>
        <p>
          <strong className="text-ink">Margen por pieza (esta pestaña):</strong> Te muestra cuánto le ganas a cada modelo que imprimes. Resta únicamente el plástico y la luz consumidos en esa pieza. Es ideal para fijar precios y saber qué productos te conviene promocionar.
        </p>
        <p>
          <strong className="text-ink">Caja del mes:</strong> Es el dinero real que entra y sale de tu cuenta bancaria. Si compraste bobinas enteras para tener stock o repuestos, esas compras se descuentan en Caja, mostrándote el dinero disponible real en tu bolsillo.
        </p>
      </Card>
    </div>
  );
}

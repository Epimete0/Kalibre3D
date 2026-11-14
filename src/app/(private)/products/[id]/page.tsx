import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductStockControls } from "@/app/(private)/products/[id]/ProductStockControls";
import { Badge, Card, segmentedItemClass, segmentedTrackClass } from "@/components/ui";
import { canManageCatalog, requireOperationalContext } from "@/lib/auth";
import { MATERIAL_LABEL, PRODUCT_MOVEMENT_LABEL, type ProductMovementKind } from "@/lib/catalog-presentation";
import { getCenterSettings } from "@/lib/center-settings-service";
import { computePieceCost, mercadoLibreNet } from "@/lib/costing";
import { formatMonth } from "@/lib/date-labels";
import { getProductPerformance } from "@/lib/insights-queries";
import { formatMoney } from "@/lib/money-format";
import { CHANNEL_LABEL, orderNumberLabel } from "@/lib/order-presentation";
import type { OrderChannel } from "@/lib/order-status";
import { getProductById } from "@/lib/product-queries";
import { listSpools } from "@/lib/spool-queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ vista?: string; month?: string }>;

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { id } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const showMonth = resolvedSearch.vista === "mes";

  const auth = await requireOperationalContext();
  const canSeeMoney = canManageCatalog(auth.role);

  const [product, settings, spoolsView, performance] = await Promise.all([
    getProductById(id),
    getCenterSettings(),
    listSpools(),
    canSeeMoney
      ? getProductPerformance(id, { all: !showMonth, month: resolvedSearch.month })
      : Promise.resolve(null),
  ]);

  if (!product) {
    notFound();
  }

  const costPerGram = spoolsView.materialCostPerGram[product.material] ?? settings.defaultCostPerKg / 1000;
  const costBreakdown = computePieceCost({
    grams: product.grams,
    colorsCount: product.colorsCount,
    purgeGrams: product.purgeGrams,
    costPerGram,
    printMinutes: product.printMinutes,
    electricityCostPerHour: settings.electricityCostPerHour,
    machineWearCostPerHour: settings.machineWearCostPerHour,
    failurePercent: settings.failurePercent,
    packagingCost: settings.defaultPackagingCost,
  });

  const mlBreakdown =
    product.mlPrice !== null
      ? mercadoLibreNet({
          salePrice: product.mlPrice,
          commissionPct: Number(settings.mlCommissionPercent),
          sellerShippingCost: settings.mlDefaultShippingCost,
        })
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 sm:pb-10">
      <div className="flex items-center justify-between gap-2">
        <Link href="/products" className="text-xs font-semibold text-muted hover:text-ink">
          ← Volver al catálogo
        </Link>
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-ink">{product.name}</h1>
              {product.category && <Badge tone="neutral">{product.category}</Badge>}
              {!product.active && <Badge tone="warn">Inactiva</Badge>}
              {product.isLowStock && <Badge tone="warn">Stock bajo</Badge>}
            </div>
            <p className="text-xs text-muted mt-1">
              Material: {MATERIAL_LABEL[product.material as keyof typeof MATERIAL_LABEL] ?? product.material} ·{" "}
              {product.grams} g ({product.colorsCount} {product.colorsCount === 1 ? "color" : "colores"}
              {product.colorsCount > 1 ? ` + ${product.purgeGrams} g purga` : ""}) · {product.printMinutes} min
            </p>
          </div>

          <div className="flex items-center justify-between sm:flex-col sm:items-end p-2.5 sm:p-0 rounded-xl bg-raised/50 sm:bg-transparent">
            <span className="text-xs sm:text-[11px] font-semibold text-muted uppercase tracking-wider">Stock actual</span>
            <span className="text-2xl font-bold text-ink tabular-nums">{product.currentStock} u.</span>
            <span className="text-xs text-muted">Stock mínimo: {product.minStock} u.</span>
          </div>
        </div>

        {canSeeMoney && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-line">
            <div className="p-3 rounded-xl bg-raised/40 sm:bg-transparent sm:p-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">Costo de fabricación</div>
              <div className="text-base sm:text-lg font-bold text-ink tabular-nums mt-0.5">
                {formatMoney(costBreakdown.totalCost, settings.currency)}
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                Filamento {formatMoney(costBreakdown.materialCost, settings.currency)}
                {costBreakdown.electricityCost > 0 && ` + Luz ${formatMoney(costBreakdown.electricityCost, settings.currency)}`}
                {costBreakdown.wearCost > 0 && ` + Desgaste ${formatMoney(costBreakdown.wearCost, settings.currency)}`}
                {costBreakdown.failureCost > 0 && ` + Fallos ${formatMoney(costBreakdown.failureCost, settings.currency)}`}
                {costBreakdown.packagingCost > 0 && ` + Embalaje ${formatMoney(costBreakdown.packagingCost, settings.currency)}`}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-raised/40 sm:bg-transparent sm:p-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">Precio venta directa</div>
              <div className="text-base sm:text-lg font-bold text-ink tabular-nums mt-0.5">
                {formatMoney(product.salePrice, settings.currency)}
              </div>
              <div className="text-[11px] text-ok font-semibold mt-0.5">
                Margen directo: +{formatMoney(product.salePrice - costBreakdown.totalCost, settings.currency)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-raised/40 sm:bg-transparent sm:p-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">Precio Mercado Libre</div>
              <div className="text-base sm:text-lg font-bold text-ink tabular-nums mt-0.5">
                {product.mlPrice !== null ? formatMoney(product.mlPrice, settings.currency) : "—"}
              </div>
              {mlBreakdown && (
                <div className="text-[11px] text-muted mt-0.5">
                  Neto ML: {formatMoney(mlBreakdown.net, settings.currency)}
                </div>
              )}
            </div>

            {mlBreakdown && (
              <div className="p-3 rounded-xl bg-raised/40 sm:bg-transparent sm:p-0">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">Margen en ML</div>
                <div className="text-base sm:text-lg font-bold text-ok tabular-nums mt-0.5">
                  +{formatMoney(mlBreakdown.net - costBreakdown.totalCost, settings.currency)}
                </div>
                <div className="text-[11px] text-muted mt-0.5">Descontando costo de pieza</div>
              </div>
            )}
          </div>
        )}
      </Card>

      <ProductStockControls productId={product.id} currentStock={product.currentStock} />

      {performance && (
        <Card className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-ink">Rendimiento real</h2>
                {performance.summary.marginPercent !== null && (
                  <Badge
                    tone={
                      performance.summary.marginPercent >= 50
                        ? "ok"
                        : performance.summary.marginPercent >= 25
                          ? "warn"
                          : "danger"
                    }
                  >
                    {performance.summary.marginPercent}% margen
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {showMonth
                  ? `Ventas reales en ${formatMonth(performance.nav.month)}`
                  : "Histórico completo de pedidos confirmados o entregados"}
              </p>
            </div>

            <div className={segmentedTrackClass}>
              <Link
                href={`/products/${product.id}`}
                className={`min-h-8 ${segmentedItemClass(!showMonth)}`}
              >
                Todo el historial
              </Link>
              <Link
                href={`/products/${product.id}?vista=mes`}
                className={`min-h-8 ${segmentedItemClass(showMonth)}`}
              >
                Este mes
              </Link>
            </div>
          </div>

          {performance.summary.ordersCount === 0 ? (
            <div className="rounded-xl border border-line/60 bg-raised/40 p-4 text-xs text-muted">
              {showMonth
                ? `No se registraron ventas de esta pieza en ${formatMonth(performance.nav.month)}.`
                : "Todavía no hay pedidos confirmados o entregados con esta pieza."}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-line/60 bg-canvas/50 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
                    Vendidas
                  </span>
                  <span className="mt-1 block text-lg font-bold text-ink tabular-nums">
                    {performance.summary.units}{" "}
                    {performance.summary.units === 1 ? "unidad" : "unidades"}
                  </span>
                  <span className="text-[11px] text-muted">
                    En {performance.summary.ordersCount}{" "}
                    {performance.summary.ordersCount === 1 ? "pedido" : "pedidos"}
                  </span>
                </div>

                <div className="rounded-xl border border-line/60 bg-canvas/50 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
                    Ingresos netos
                  </span>
                  <span className="mt-1 block text-lg font-bold text-ink tabular-nums">
                    {formatMoney(performance.summary.netRevenue, settings.currency)}
                  </span>
                  <span className="text-[11px] text-muted">
                    {performance.vatPercent > 0
                      ? `Sin IVA (bruto ${formatMoney(performance.summary.grossRevenue, settings.currency)})`
                      : "Tras comisiones y descuentos"}
                  </span>
                </div>

                <div className="rounded-xl border border-line/60 bg-canvas/50 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
                    Costo fabricación
                  </span>
                  <span className="mt-1 block text-lg font-bold text-ink tabular-nums">
                    {formatMoney(performance.summary.productionCost, settings.currency)}
                  </span>
                  <span className="text-[11px] text-muted">Filamento, luz y embalaje</span>
                </div>

                <div className="rounded-xl border border-primary/25 bg-surface p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block">
                    Ganancia real
                  </span>
                  <span
                    className={`mt-1 block text-lg font-bold tabular-nums ${
                      performance.summary.profit >= 0 ? "text-ok" : "text-danger"
                    }`}
                  >
                    {performance.summary.profit >= 0 ? "+" : ""}
                    {formatMoney(performance.summary.profit, settings.currency)}
                  </span>
                  <span className="text-[11px] text-muted">Lo que dejó al taller</span>
                </div>
              </div>

              {performance.summary.netRevenue > 0 && (() => {
                const profitPct = Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(
                      (Math.max(0, performance.summary.profit) / performance.summary.netRevenue) * 100
                    )
                  )
                );
                const costPct = Math.max(0, 100 - profitPct);
                return (
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-full rounded-full bg-raised overflow-hidden flex">
                      {profitPct > 0 && (
                        <div className="h-full bg-ok" style={{ width: `${profitPct}%` }} />
                      )}
                      {costPct > 0 && (
                        <div className="h-full bg-primary" style={{ width: `${costPct}%` }} />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span>
                        Ganancia: <strong className="text-ink font-semibold">{profitPct}%</strong>
                      </span>
                      <span>
                        Costo fabricación: <strong className="text-ink font-semibold">{costPct}%</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}

              {performance.summary.unitsEstimatedToday > 0 && (
                <p className="text-[11px] text-muted">
                  Nota: para {performance.summary.unitsEstimatedToday}{" "}
                  {performance.summary.unitsEstimatedToday === 1 ? "unidad" : "unidades"} sin costo histórico guardado se usaron tus tarifas actuales.
                </p>
              )}

              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                  Pedidos recientes ({performance.summary.recentOrders.length})
                </h3>
                <div className="divide-y divide-line/70 rounded-xl border border-line/70 bg-canvas/40 px-3.5">
                  {performance.summary.recentOrders.slice(0, 10).map((row) => (
                    <Link
                      key={row.orderId}
                      href={`/orders/${row.orderId}`}
                      className="py-2.5 flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                          <span className="font-bold text-primary group-hover:underline">
                            {orderNumberLabel(row.orderNumber)}
                          </span>
                          <span className="text-muted">
                            · {CHANNEL_LABEL[row.channel as OrderChannel] ?? row.channel}
                          </span>
                          <span className="font-semibold text-ink">· {row.qty}×</span>
                        </div>
                        <p className="text-[11px] text-muted">
                          {new Date(row.createdAt).toLocaleDateString("es-CL")} · Neto{" "}
                          {formatMoney(row.netRevenue, settings.currency)} · Costo{" "}
                          {formatMoney(row.cost, settings.currency)}
                        </p>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <span
                          className={`text-sm font-bold ${
                            row.profit >= 0 ? "text-ok" : "text-danger"
                          }`}
                        >
                          {row.profit >= 0 ? "+" : ""}
                          {formatMoney(row.profit, settings.currency)}
                        </span>
                        <span className="block text-[11px] text-muted">ganancia</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      <Card className="p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-ink">
          Historial de stock ({product.movements.length})
        </h2>

        {product.movements.length === 0 ? (
          <p className="text-sm text-muted">Sin movimientos de stock registrados.</p>
        ) : (
          <div className="divide-y divide-line">
            {product.movements.map((mov) => (
              <div key={mov.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {PRODUCT_MOVEMENT_LABEL[mov.kind as ProductMovementKind] ?? mov.kind}
                    </span>
                    {mov.orderId && mov.orderNumber !== null && (
                      <Link
                        href={`/orders/${mov.orderId}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Pedido #{mov.orderNumber}
                      </Link>
                    )}
                  </div>
                  {mov.notes && <p className="text-xs text-muted">{mov.notes}</p>}
                  <p className="text-[11px] text-muted">
                    {new Date(mov.createdAt).toLocaleString("es-CL")} · {mov.actorName}
                  </p>
                </div>

                <div className="text-right tabular-nums">
                  <div
                    className={`text-sm font-bold ${
                      mov.delta < 0 ? "text-warn" : "text-ok"
                    }`}
                  >
                    {mov.delta > 0 ? `+${mov.delta}` : mov.delta} u.
                  </div>
                  <div className="text-xs text-muted">Quedan {mov.resultingStock} u.</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

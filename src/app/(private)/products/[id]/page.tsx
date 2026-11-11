import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductStockControls } from "@/app/(private)/products/[id]/ProductStockControls";
import { Badge, Card } from "@/components/ui";
import { canManageCatalog, requireOperationalContext } from "@/lib/auth";
import { MATERIAL_LABEL, PRODUCT_MOVEMENT_LABEL, type ProductMovementKind } from "@/lib/catalog-presentation";
import { getCenterSettings } from "@/lib/center-settings-service";
import { computePieceCost, mercadoLibreNet } from "@/lib/costing";
import { formatMoney } from "@/lib/money-format";
import { getProductById } from "@/lib/product-queries";
import { listSpools } from "@/lib/spool-queries";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const auth = await requireOperationalContext();
  const canSeeMoney = canManageCatalog(auth.role);

  const [product, settings, spoolsView] = await Promise.all([
    getProductById(id),
    getCenterSettings(),
    listSpools(),
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
                Filamento {formatMoney(costBreakdown.materialCost, settings.currency)} + Luz{" "}
                {formatMoney(costBreakdown.electricityCost, settings.currency)}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-raised/40 sm:bg-transparent sm:p-0">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider">Precio venta directa</div>
              <div className="text-base sm:text-lg font-bold text-ink tabular-nums mt-0.5">
                {formatMoney(product.salePrice, settings.currency)}
              </div>
              <div className="text-[11px] text-ok font-semibold mt-0.5">
                Ganancia: +{formatMoney(product.salePrice - costBreakdown.totalCost, settings.currency)}
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
                <div className="text-xs font-semibold text-muted uppercase tracking-wider">Ganancia real en ML</div>
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

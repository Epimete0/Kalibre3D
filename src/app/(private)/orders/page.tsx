import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { formatMoney } from "@/lib/money-format";
import { listOrdersSummary } from "@/lib/order-queries";
import { CHANNEL_LABEL, STATUS_LABEL, orderNumberLabel } from "@/lib/order-presentation";
import type { OrderChannel, OrderStatus } from "@/lib/order-status";

export const metadata = {
  title: "Pedidos y Ventas | saas3d",
};

export default async function OrdersPage() {
  const { role } = await requireAuthContext();
  const [orders, settings] = await Promise.all([
    listOrdersSummary(),
    getCenterSettings(),
  ]);

  const canCreate = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Pedidos y Ventas"
        description="Historial de ventas entregadas y pedidos por encargo."
      >
        {canCreate && (
          <Link
            href="/orders/new"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm hover:bg-primary-hover transition-colors"
          >
            + Nueva venta
          </Link>
        )}
      </PageHeader>

      {orders.length === 0 ? (
        <EmptyState
          title="No hay ventas registradas"
          description="Comienza registrando tu primera venta o pedido."
        >
          {canCreate && (
            <Link
              href="/orders/new"
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-white shadow-sm"
            >
              + Registrar venta
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const status = o.status as OrderStatus;
            const channel = o.channel as OrderChannel;

            return (
              <Card key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{orderNumberLabel(o.number)}</span>
                    <Badge tone={o.status === "DELIVERED" ? "ok" : "warn"}>
                      {STATUS_LABEL[status] ?? o.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span>{CHANNEL_LABEL[channel] ?? o.channel}</span>
                    <span>•</span>
                    <span>{o.customerName ?? "Sin cliente"}</span>
                    <span>•</span>
                    <span>{o.itemsCount} {o.itemsCount === 1 ? "pieza" : "piezas"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-line/60">
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-muted block">Total</span>
                    <span className="font-bold text-ink text-base">
                      {o.total === null ? "—" : formatMoney(o.total, settings.currency)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

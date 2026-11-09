import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { formatMoney } from "@/lib/money-format";
import {
  CHANNEL_LABEL,
  KIND_LABEL,
  orderNumberLabel,
  STATUS_LABEL,
} from "@/lib/order-presentation";
import { getOrderDetail } from "@/lib/order-queries";
import type { OrderStatus } from "@/lib/order-status";
import { OrderDetailStatusControls } from "./OrderDetailStatusControls";
import { OrderMoneyControls } from "./OrderMoneyControls";
import { formatDay } from "@/lib/date-labels";

export const metadata = {
  title: "Detalle de pedido | Kalibre",
};

function statusTone(status: OrderStatus): "neutral" | "ok" | "warn" | "danger" | "accent" {
  switch (status) {
    case "QUOTED":
      return "neutral";
    case "CONFIRMED":
      return "accent";
    case "PRINTING":
      return "warn";
    case "READY":
    case "DELIVERED":
      return "ok";
    case "RETURNED":
      return "danger";
    case "CANCELED":
    default:
      return "neutral";
  }
}

function formatDateTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("es-CL", {
      timeZone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

function cleanPhoneForWhatsApp(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

export default async function OrderDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const { role, timeZone } = await requireAuthContext();
  const tz = timeZone ?? "America/Santiago";

  const [order, settings] = await Promise.all([
    getOrderDetail(id),
    getCenterSettings(),
  ]);

  if (!order) {
    notFound();
  }

  const canManage = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";
  const canManageMoney = role === "OWNER" || role === "ADMIN";
  const isViewer = role === "VIEWER";
  const currency = settings.currency;

  return (
    <div className="space-y-5 pb-24">
      {/* Navegación superior móvil y escritorio */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/orders"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-raised px-3.5 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-canvas transition-colors touch-manipulation"
        >
          ← Volver a pedidos
        </Link>

        {canManage && (
          <Link
            href="/orders/new"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-primary-hover transition-colors touch-manipulation"
          >
            + Nueva venta
          </Link>
        )}
      </div>

      {/* Encabezado principal del pedido y acciones de estado */}
      <Card
        className={`p-4 sm:p-6 space-y-4 ${
          order.isOverdue ? "border-danger/50 bg-danger-soft/10" : ""
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                {orderNumberLabel(order.number)}
              </h1>
              <Badge tone={statusTone(order.status)}>
                {STATUS_LABEL[order.status]}
              </Badge>
              {order.isOverdue && <Badge tone="danger">Atrasado</Badge>}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm text-muted">
              <span className="font-semibold text-ink/85">
                {CHANNEL_LABEL[order.channel]}
              </span>
              <span>•</span>
              <span>{KIND_LABEL[order.kind]}</span>
              <span>•</span>
              <span>Creado: {formatDateTime(order.createdAt, tz)}</span>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col sm:items-end gap-2 text-xs">
            {order.dueDate && (
              <div
                className={`rounded-lg border px-2.5 py-1.5 font-medium ${
                  order.isOverdue
                    ? "border-danger/40 bg-danger-soft text-danger"
                    : "border-line bg-raised text-ink"
                }`}
              >
                Entrega comprometida: <strong>{formatDay(order.dueDate)}</strong>
              </div>
            )}
            {order.deliveredAt && (
              <div className="rounded-lg border border-ok/30 bg-ok-soft px-2.5 py-1.5 font-medium text-ok">
                Entregado: <strong>{formatDateTime(order.deliveredAt, tz)}</strong>
              </div>
            )}
          </div>
        </div>

        {canManage && (
          <OrderDetailStatusControls
            orderId={order.id}
            currentStatus={order.status}
            version={order.version}
          />
        )}
      </Card>

      {/* Grid principal: Cliente + Resumen financiero */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Piezas del pedido */}
          <Card className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Piezas ({order.items.reduce((acc, i) => acc + i.qty, 0)})
              </h2>
              {order.channel === "MERCADOLIBRE" && (
                <Badge tone="accent">Venta por Mercado Libre</Badge>
              )}
            </div>

            <div className="divide-y divide-line/70">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="inline-flex items-center justify-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {item.qty}×
                      </span>
                      <span className="font-semibold text-ink text-sm sm:text-base break-words">
                        {item.description}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {item.material && (
                        <span className="rounded bg-raised px-1.5 py-0.5 font-medium text-ink/80 border border-line/60">
                          {item.material}
                        </span>
                      )}
                      <span>
                        {item.colorsCount}{" "}
                        {item.colorsCount === 1 ? "color" : "colores"}
                      </span>
                      {item.grams !== null && <span>• {item.grams} g</span>}
                      {!isViewer && item.unitPrice !== null && (
                        <span>
                          • {formatMoney(item.unitPrice, currency)} c/u
                        </span>
                      )}
                    </div>
                  </div>

                  {!isViewer && item.subtotal !== null && (
                    <div className="text-right shrink-0 font-bold text-ink text-sm sm:text-base">
                      {formatMoney(item.subtotal, currency)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {order.notes && (
              <div className="rounded-xl border border-line bg-canvas/60 p-3.5 text-xs sm:text-sm">
                <span className="font-semibold text-ink block mb-1">
                  Notas del pedido:
                </span>
                <p className="text-muted whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
          </Card>

          {/* Cobros, anulaciones y devoluciones de dinero (Tarea 1.7) */}
          <Card className="p-4 sm:p-6">
            <OrderMoneyControls
              orderId={order.id}
              channel={order.channel}
              status={order.status}
              version={order.version}
              currency={currency}
              expectedReceivable={order.expectedReceivable}
              paidAmount={order.paidAmount}
              balance={order.balance}
              transactions={order.transactions}
              canManageMoney={canManageMoney}
              isViewer={isViewer}
            />
          </Card>

          {/* Historial de estados (OrderEvent) */}
          <Card className="p-4 sm:p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-ink">
              Historial de estados
            </h2>

            <ol className="relative border-l border-line ml-2 space-y-4 pl-4">
              {order.events.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-surface" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="text-xs sm:text-sm font-medium text-ink">
                      {ev.fromStatus ? (
                        <>
                          Pasó de{" "}
                          <span className="font-semibold">
                            {STATUS_LABEL[ev.fromStatus]}
                          </span>{" "}
                          a{" "}
                          <span className="font-bold text-primary">
                            {STATUS_LABEL[ev.toStatus]}
                          </span>
                        </>
                      ) : (
                        <>
                          Pedido creado como{" "}
                          <span className="font-bold text-primary">
                            {STATUS_LABEL[ev.toStatus]}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-[11px] text-muted">
                      v{ev.version} · {formatDateTime(ev.occurredAt, tz)}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Registrado por {ev.actorName}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        {/* Columna lateral: Cliente y Resumen Financiero */}
        <div className="space-y-5">
          {/* Tarjeta de Cliente */}
          <Card className="p-4 sm:p-6 space-y-3">
            <h2 className="text-base font-bold text-ink">Cliente</h2>
            {order.customer ? (
              <div className="space-y-3">
                <div>
                  <Link
                    href={`/clients/${order.customer.id}`}
                    className="text-base font-bold text-primary hover:underline"
                  >
                    {order.customer.name}
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  {order.customer.phone && (
                    <a
                      href={`https://wa.me/${cleanPhoneForWhatsApp(order.customer.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
                    >
                      💬 WhatsApp ({order.customer.phone})
                    </a>
                  )}
                  {order.customer.instagram && (
                    <a
                      href={`https://instagram.com/${order.customer.instagram.replace(/^@+/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
                    >
                      📸 @{order.customer.instagram.replace(/^@+/, "")}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-muted">
                Sin cliente asignado (venta directa).
              </p>
            )}
          </Card>

          {/* Tarjeta de Resumen Financiero */}
          {!isViewer && (
            <Card className="p-4 sm:p-6 space-y-3">
              <h2 className="text-base font-bold text-ink">Resumen financiero</h2>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between text-muted">
                  <span>Subtotal piezas</span>
                  <span className="font-medium text-ink">
                    {order.subtotal !== null ? formatMoney(order.subtotal, currency) : "—"}
                  </span>
                </div>

                {order.discount !== null && order.discount > 0 && (
                  <div className="flex items-center justify-between text-muted">
                    <span>Descuento</span>
                    <span className="font-medium text-danger">
                      −{formatMoney(order.discount, currency)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-line/70 pt-2 font-bold text-ink">
                  <span>Total venta</span>
                  <span className="text-base">
                    {order.total !== null ? formatMoney(order.total, currency) : "—"}
                  </span>
                </div>

                {order.channel === "MERCADOLIBRE" && (
                  <div className="mt-2 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 space-y-1.5 text-xs">
                    {order.mlOrderRef && (
                      <div className="flex items-center justify-between text-muted pb-1 border-b border-accent/20">
                        <span>Ref. Mercado Libre</span>
                        <span className="font-mono font-semibold text-ink">
                          {order.mlOrderRef}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-muted">
                      <span>Comisión ML</span>
                      <span className="font-medium text-danger">
                        −{formatMoney(order.mlCommission ?? 0, currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted">
                      <span>Envío a tu cargo</span>
                      <span className="font-medium text-danger">
                        −{formatMoney(order.mlShippingCost ?? 0, currency)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-accent/20 pt-1.5 font-bold text-ink text-sm">
                      <span>Neto real ML</span>
                      <span>
                        {order.expectedReceivable !== null
                          ? formatMoney(order.expectedReceivable, currency)
                          : "—"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="border-t border-line/70 pt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-muted">
                    <span>Cobrado</span>
                    <span className="font-semibold text-ok">
                      {order.paidAmount !== null
                        ? formatMoney(order.paidAmount, currency)
                        : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between font-bold text-base">
                    <span>Saldo pendiente</span>
                    <span
                      className={
                        order.balance !== null && order.balance > 0
                          ? "text-warn"
                          : "text-ok"
                      }
                    >
                      {order.balance !== null
                        ? order.balance > 0
                          ? formatMoney(order.balance, currency)
                          : "Pagado"
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

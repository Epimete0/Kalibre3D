"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge, Card, EmptyState, inputClass } from "@/components/ui";
import { formatMoney } from "@/lib/money-format";
import type { OrderListFilterChannel, OrderListFilterStatus, OrderListItem } from "@/lib/order-queries";
import {
  CHANNEL_LABEL,
  KIND_LABEL,
  orderNumberLabel,
  STATUS_ACTION_LABEL,
  STATUS_LABEL,
} from "@/lib/order-presentation";
import {
  isClosedStatus,
  nextStatuses,
  ORDER_CHANNELS,
  type OrderChannel,
  type OrderStatus,
} from "@/lib/order-status";
import { changeOrderStatusAction } from "./actions";
import { formatDay } from "@/lib/date-labels";

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

function primaryNextStatus(status: OrderStatus): OrderStatus | null {
  const candidates = nextStatuses(status).filter((s) => s !== "CANCELED" && s !== "RETURNED");
  return candidates[0] ?? null;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const STATUS_TABS: Array<{ id: OrderListFilterStatus; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "ACTIVE", label: "Pendientes" },
  { id: "QUOTED", label: "Cotizados" },
  { id: "CONFIRMED", label: "Confirmados" },
  { id: "PRINTING", label: "Imprimiendo" },
  { id: "READY", label: "Listos" },
  { id: "DELIVERED", label: "Entregados" },
  { id: "CANCELED", label: "Cancelados" },
];

export function OrderListControls({
  orders,
  currency,
  canManage,
  isViewer,
}: {
  orders: OrderListItem[];
  currency: string;
  canManage: boolean;
  isViewer: boolean;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<OrderListFilterStatus>("ALL");
  const [channelFilter, setChannelFilter] = useState<OrderListFilterChannel>("ALL");
  const [query, setQuery] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredOrders = useMemo(() => {
    const q = normalizeText(query);
    const numQ = q.startsWith("#") ? q.slice(1).trim() : q;

    return orders.filter((order) => {
      if (statusFilter === "ACTIVE") {
        if (isClosedStatus(order.status)) return false;
      } else if (statusFilter !== "ALL") {
        if (order.status !== statusFilter) return false;
      }

      if (channelFilter !== "ALL" && order.channel !== channelFilter) {
        return false;
      }

      if (q) {
        const matchNumber = numQ.length > 0 && String(order.number).includes(numQ);
        const matchCustomer =
          order.customerName !== null && normalizeText(order.customerName).includes(q);
        const matchItems = normalizeText(order.itemsSummary).includes(q);
        if (!matchNumber && !matchCustomer && !matchItems) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, channelFilter, query]);

  const overdueCount = useMemo(
    () => orders.filter((o) => o.isOverdue).length,
    [orders]
  );

  function handleQuickAdvance(order: OrderListItem, next: OrderStatus) {
    setFeedbackError(null);
    setPendingOrderId(order.id);
    startTransition(async () => {
      const res = await changeOrderStatusAction({
        orderId: order.id,
        expectedVersion: order.version,
        to: next,
      });
      setPendingOrderId(null);
      if (res.error) {
        setFeedbackError(res.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {feedbackError && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
        >
          {feedbackError}
        </div>
      )}

      {overdueCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft/70 px-4 py-3 text-xs sm:text-sm">
          <div className="font-medium text-danger">
            Tienes {overdueCount} {overdueCount === 1 ? "pedido atrasado" : "pedidos atrasados"} que{" "}
            {overdueCount === 1 ? "aparece" : "aparecen"} primero en la lista.
          </div>
          {statusFilter !== "ACTIVE" && (
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className="shrink-0 rounded-lg border border-danger/30 bg-surface px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft transition-colors"
            >
              Ver pendientes
            </button>
          )}
        </div>
      )}

      {/* Buscador y selector de canal (adaptado a móvil 390px) */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="search"
              inputMode="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por #número, cliente o pieza…"
              aria-label="Buscar pedidos por número, cliente o pieza"
              className={`${inputClass} min-h-11 pl-3 pr-9 text-base sm:text-sm`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as OrderListFilterChannel)}
            aria-label="Filtrar por canal de venta"
            className={`${inputClass} sm:w-52 min-h-11 text-base sm:text-sm`}
          >
            <option value="ALL">Todos los canales</option>
            {ORDER_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {CHANNEL_LABEL[ch]}
              </option>
            ))}
          </select>
        </div>

        {/* Pestañas de estado desplazables horizontalmente en móvil */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 -mx-1 px-1">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`shrink-0 min-h-10 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors touch-manipulation ${
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "border border-line bg-raised text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Card>

      {filteredOrders.length === 0 ? (
        <EmptyState
          title={orders.length === 0 ? "Aquí aparecerán tus ventas y pedidos" : "Ningún pedido coincide con el filtro"}
          description={
            orders.length === 0
              ? "Registra tu primera venta: solo anotas qué vendiste y en cuánto. Si es un encargo, aquí sigues en qué etapa va."
              : "Prueba con otro estado, canal o texto de búsqueda."
          }
        >
          {orders.length === 0 && canManage ? (
            <Link
              href="/orders/new"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
            >
              + Registrar primera venta
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setChannelFilter("ALL");
                setQuery("");
              }}
              className="inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-raised px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas"
            >
              Limpiar filtros
            </button>
          )}
        </EmptyState>
      ) : (
        <>
          {/* Vista móvil en tarjetas (principal, 390px) */}
          <div className="space-y-3 md:hidden">
            {filteredOrders.map((order) => {
              const next = canManage ? primaryNextStatus(order.status) : null;
              const isThisPending = isPending && pendingOrderId === order.id;

              return (
                <Card
                  key={order.id}
                  className={`p-4 transition-colors ${
                    order.isOverdue ? "border-danger/50 bg-danger-soft/15" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="group flex-1 min-w-0 focus:outline-none"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-base font-bold text-ink group-hover:text-primary">
                          {orderNumberLabel(order.number)}
                        </span>
                        <Badge tone={statusTone(order.status)}>
                          {STATUS_LABEL[order.status]}
                        </Badge>
                        {order.isOverdue && <Badge tone="danger">Atrasado</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <span className="font-medium text-ink/80">
                          {CHANNEL_LABEL[order.channel]}
                        </span>
                        <span>•</span>
                        <span>{order.customerName ?? "Sin cliente"}</span>
                        {order.dueDate && (
                          <>
                            <span>•</span>
                            <span className={order.isOverdue ? "font-semibold text-danger" : ""}>
                              Entrega: {formatDay(order.dueDate)}
                            </span>
                          </>
                        )}
                      </div>
                    </Link>

                    {!isViewer && order.expectedReceivable !== null && (
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-ink">
                          {formatMoney(order.expectedReceivable, currency)}
                        </div>
                        {order.channel === "MERCADOLIBRE" && (
                          <span className="block text-[10px] text-muted">Neto ML</span>
                        )}
                        {order.balance !== null && order.balance > 0 ? (
                          <span className="inline-block mt-0.5 text-[11px] font-semibold text-warn">
                            Por cobrar: {formatMoney(order.balance, currency)}
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 text-[11px] font-medium text-ok">
                            Al día
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs text-muted">
                    {order.itemsSummary || `${order.itemsCount} pieza(s)`}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-3">
                    <Link
                      href={`/orders/${order.id}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-raised px-3.5 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
                    >
                      Ver detalle
                    </Link>

                    {next && (
                      <button
                        type="button"
                        disabled={isThisPending}
                        onClick={() => handleQuickAdvance(order, next)}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 touch-manipulation"
                      >
                        {isThisPending ? "Guardando…" : STATUS_ACTION_LABEL[next]}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Vista en computador (tabla) */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas/70 text-xs font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Piezas</th>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3">Entrega</th>
                    <th className="px-4 py-3">Estado</th>
                    {!isViewer && <th className="px-4 py-3 text-right">Monto</th>}
                    {!isViewer && <th className="px-4 py-3 text-right">Saldo</th>}
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {filteredOrders.map((order) => {
                    const next = canManage ? primaryNextStatus(order.status) : null;
                    const isThisPending = isPending && pendingOrderId === order.id;

                    return (
                      <tr
                        key={order.id}
                        className={`hover:bg-canvas/40 transition-colors ${
                          order.isOverdue ? "bg-danger-soft/10" : ""
                        }`}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-bold text-ink hover:text-primary"
                          >
                            #{order.number}
                          </Link>
                          <span className="block text-[11px] text-muted">
                            {KIND_LABEL[order.kind]}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-ink">
                            {order.customerName ?? <span className="text-muted">Sin cliente</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="truncate text-ink" title={order.itemsSummary}>
                            {order.itemsSummary}
                          </p>
                          <span className="text-xs text-muted">
                            {order.itemsCount} {order.itemsCount === 1 ? "pieza" : "piezas"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs font-medium text-ink">
                          {CHANNEL_LABEL[order.channel as OrderChannel] ?? order.channel}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                          {order.dueDate ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  order.isOverdue ? "font-bold text-danger" : "text-ink"
                                }
                              >
                                {formatDay(order.dueDate)}
                              </span>
                              {order.isOverdue && <Badge tone="danger">Atrasado</Badge>}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge tone={statusTone(order.status)}>
                            {STATUS_LABEL[order.status]}
                          </Badge>
                        </td>
                        {!isViewer && (
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold text-ink">
                            {order.expectedReceivable !== null
                              ? formatMoney(order.expectedReceivable, currency)
                              : "—"}
                            {order.channel === "MERCADOLIBRE" && (
                              <span className="block text-[10px] font-normal text-muted">
                                Neto ML
                              </span>
                            )}
                          </td>
                        )}
                        {!isViewer && (
                          <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                            {order.balance !== null && order.balance > 0 ? (
                              <span className="font-semibold text-warn">
                                {formatMoney(order.balance, currency)}
                              </span>
                            ) : (
                              <span className="font-medium text-ok">Al día</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            {next && (
                              <button
                                type="button"
                                disabled={isThisPending}
                                onClick={() => handleQuickAdvance(order, next)}
                                className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                              >
                                {isThisPending ? "Guardando…" : STATUS_ACTION_LABEL[next]}
                              </button>
                            )}
                            <Link
                              href={`/orders/${order.id}`}
                              className="rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                            >
                              Ver detalle
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

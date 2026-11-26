"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  Badge,
  Card,
  EmptyState,
  filterChipClass,
  inputClass,
  segmentedItemClass,
  segmentedTrackClass,
} from "@/components/ui";
import { formatDay } from "@/lib/date-labels";
import { formatMoney } from "@/lib/money-format";
import {
  extractOrderMonths,
  groupOrdersByDate,
  type OrderDateMode,
} from "@/lib/order-grouping";
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
];

export function OrderListControls({
  orders,
  currency,
  todayStr,
  initialStatus = "ALL",
  initialDateMode = "created",
  initialMonth = "ALL",
  canManage,
  isViewer,
}: {
  orders: OrderListItem[];
  currency: string;
  todayStr: string;
  initialStatus?: OrderListFilterStatus;
  initialDateMode?: OrderDateMode;
  initialMonth?: string;
  canManage: boolean;
  isViewer: boolean;
}) {
  const router = useRouter();
  const [dateMode, setDateMode] = useState<OrderDateMode>(initialDateMode);
  const [monthFilter, setMonthFilter] = useState<string>(initialMonth);
  const [statusFilter, setStatusFilter] = useState<OrderListFilterStatus>(initialStatus);
  const [channelFilter, setChannelFilter] = useState<OrderListFilterChannel>("ALL");
  const [query, setQuery] = useState("");
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableMonths = useMemo(
    () => extractOrderMonths(orders, dateMode),
    [orders, dateMode]
  );

  // Si al cambiar de modo el mes elegido ya no existe en las opciones, mostramos todos.
  const activeMonth = useMemo(() => {
    if (monthFilter === "ALL") return "ALL";
    return availableMonths.some((m) => m.month === monthFilter) ? monthFilter : "ALL";
  }, [monthFilter, availableMonths]);

  const monthScopedOrders = useMemo(() => {
    if (activeMonth === "ALL") return orders;
    return orders.filter((order) => {
      const targetDate = dateMode === "created" ? order.createdOn : order.dueDate;
      return targetDate !== null && targetDate.startsWith(activeMonth);
    });
  }, [orders, activeMonth, dateMode]);

  const filteredOrders = useMemo(() => {
    const q = normalizeText(query);
    const numQ = q.startsWith("#") ? q.slice(1).trim() : q;

    return monthScopedOrders.filter((order) => {
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
  }, [monthScopedOrders, statusFilter, channelFilter, query]);

  const groupedOrders = useMemo(
    () =>
      groupOrdersByDate(filteredOrders, {
        mode: dateMode,
        todayStr,
        hideTotals: isViewer,
      }),
    [filteredOrders, dateMode, todayStr, isViewer]
  );

  const overdueCount = useMemo(
    () => orders.filter((o) => o.isOverdue).length,
    [orders]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<OrderListFilterStatus, number> = {
      ALL: monthScopedOrders.length,
      ACTIVE: 0,
      QUOTED: 0,
      CONFIRMED: 0,
      PRINTING: 0,
      READY: 0,
      DELIVERED: 0,
      CANCELED: 0,
      RETURNED: 0,
    };
    for (const o of monthScopedOrders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
      if (!isClosedStatus(o.status)) {
        counts.ACTIVE += 1;
      }
    }
    return counts;
  }, [monthScopedOrders]);

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

  const desktopColCount = isViewer ? 7 : 9;

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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger-soft/70 px-4 py-3 text-xs sm:text-sm">
          <div className="font-medium text-danger">
            Tienes {overdueCount} {overdueCount === 1 ? "pedido atrasado" : "pedidos atrasados"} con fecha de entrega vencida.
          </div>
          {(statusFilter !== "ACTIVE" || dateMode !== "due" || activeMonth !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setDateMode("due");
                setMonthFilter("ALL");
                setStatusFilter("ACTIVE");
              }}
              className="shrink-0 rounded-lg border border-danger/30 bg-surface px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft transition-colors"
            >
              Ver entregas atrasadas
            </button>
          )}
        </div>
      )}

      {/* Buscador, mes, canal, modo de fecha y pestañas de estado */}
      <Card className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-2.5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-2.5">
            <select
              value={activeMonth}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filtrar pedidos por mes"
              className={`${inputClass} lg:w-48 min-h-11 text-base sm:text-sm`}
            >
              <option value="ALL">Todos los meses</option>
              {availableMonths.map((m) => (
                <option key={m.month} value={m.month}>
                  {m.label} ({m.count})
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as OrderListFilterChannel)}
              aria-label="Filtrar por canal de venta"
              className={`${inputClass} lg:w-48 min-h-11 text-base sm:text-sm`}
            >
              <option value="ALL">Todos los canales</option>
              {ORDER_CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {CHANNEL_LABEL[ch]}
                </option>
              ))}
            </select>

            {canManage && (
              <Link
                href="/orders/new"
                className="hidden lg:inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] hover:bg-primary-hover transition-colors touch-manipulation"
              >
                + Nueva venta
              </Link>
            )}
          </div>
        </div>

        {/* Pestañas de estado + selector de organización por fecha */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-0.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 -mx-1 px-1">
            {STATUS_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              const count = tabCounts[tab.id] ?? 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`shrink-0 ${filterChipClass(active)}`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      active ? "bg-surface/20 text-surface" : "bg-raised text-muted"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className={`${segmentedTrackClass} shrink-0 self-start md:self-auto`}
            role="group"
            aria-label="Organizar pedidos por fecha"
          >
            <button
              type="button"
              aria-pressed={dateMode === "created"}
              onClick={() => setDateMode("created")}
              className={`min-h-8 ${segmentedItemClass(dateMode === "created")}`}
            >
              Por fecha de pedido
            </button>
            <button
              type="button"
              aria-pressed={dateMode === "due"}
              onClick={() => setDateMode("due")}
              className={`min-h-8 ${segmentedItemClass(dateMode === "due")}`}
            >
              Por entrega
            </button>
          </div>
        </div>
      </Card>

      {filteredOrders.length === 0 ? (
        <EmptyState
          title={orders.length === 0 ? "Aquí aparecerán tus ventas y pedidos" : "Ningún pedido coincide con el filtro"}
          description={
            orders.length === 0
              ? "Registra tu primera venta: solo anotas qué vendiste y en cuánto. Si es un encargo, aquí sigues en qué etapa va."
              : "Prueba con otro mes, estado, canal o texto de búsqueda."
          }
        >
          {orders.length === 0 && canManage ? (
            <Link
              href="/orders/new"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] hover:bg-primary-hover"
            >
              + Registrar primera venta
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMonthFilter("ALL");
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
          {/* Vista móvil agrupada por día (principal, 390px) */}
          <div className="space-y-5 md:hidden">
            {groupedOrders.map((group) => (
              <section key={group.dateKey ?? "no-date"} className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider truncate ${
                        dateMode === "due" && group.isOverdueGroup ? "text-danger" : "text-ink"
                      }`}
                    >
                      {group.label}
                    </h2>
                    {dateMode === "due" && group.isOverdueGroup && (
                      <Badge tone="danger">Atrasado</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted shrink-0 tabular-nums">
                    <span>
                      {group.count} {group.count === 1 ? "pedido" : "pedidos"}
                    </span>
                    {!isViewer && group.totalReceivable !== null && (
                      <span className="font-semibold text-ink">
                        · {formatMoney(group.totalReceivable, currency)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {group.orders.map((order) => {
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
                              <span>·</span>
                              <span>{order.customerName ?? "Sin cliente"}</span>
                              {dateMode === "created" && order.dueDate && (
                                <>
                                  <span>·</span>
                                  <span className={order.isOverdue ? "font-semibold text-danger" : ""}>
                                    Entrega: {formatDay(order.dueDate)}
                                  </span>
                                </>
                              )}
                              {dateMode === "due" && (
                                <>
                                  <span>·</span>
                                  <span>Pedido: {formatDay(order.createdOn)}</span>
                                </>
                              )}
                            </div>
                          </Link>

                          {!isViewer && order.expectedReceivable !== null && (
                            <div className="text-right shrink-0">
                              <div className="text-sm font-bold text-ink tabular-nums">
                                {formatMoney(order.expectedReceivable, currency)}
                              </div>
                              {order.channel === "MERCADOLIBRE" && (
                                <span className="block text-[10px] text-muted">Neto ML</span>
                              )}
                              {order.balance !== null && order.balance > 0 ? (
                                <span className="inline-block mt-0.5 text-[11px] font-semibold text-warn tabular-nums">
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
                            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-raised px-3.5 text-xs font-semibold text-ink hover:bg-canvas touch-manipulation"
                          >
                            Ver detalle
                          </Link>

                          {next && (
                            <button
                              type="button"
                              disabled={isThisPending}
                              onClick={() => handleQuickAdvance(order, next)}
                              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50 touch-manipulation"
                            >
                              {isThisPending ? "Guardando…" : STATUS_ACTION_LABEL[next]}
                            </button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {/* Vista en computador (tabla agrupada por fecha) */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line bg-canvas/70 text-xs font-semibold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3">Pedido</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Piezas</th>
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3">
                      {dateMode === "created" ? "Entrega" : "Fecha pedido"}
                    </th>
                    <th className="px-4 py-3">Estado</th>
                    {!isViewer && <th className="px-4 py-3 text-right">Monto</th>}
                    {!isViewer && <th className="px-4 py-3 text-right">Saldo</th>}
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {groupedOrders.map((group) => (
                    <Fragment key={group.dateKey ?? "no-date"}>
                      <tr className="bg-raised/75 border-y border-line/80">
                        <td colSpan={desktopColCount} className="px-4 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold uppercase tracking-wider ${
                                  dateMode === "due" && group.isOverdueGroup
                                    ? "text-danger"
                                    : "text-ink"
                                }`}
                              >
                                {group.label}
                              </span>
                              {dateMode === "due" && group.isOverdueGroup && (
                                <Badge tone="danger">Atrasado</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted tabular-nums">
                              <span>
                                {group.count} {group.count === 1 ? "pedido" : "pedidos"}
                              </span>
                              {!isViewer && group.totalReceivable !== null && (
                                <span className="font-semibold text-ink">
                                  · {formatMoney(group.totalReceivable, currency)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

                      {group.orders.map((order) => {
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
                              {dateMode === "created" ? (
                                order.dueDate ? (
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
                                )
                              ) : (
                                <span className="text-muted">{formatDay(order.createdOn)}</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <Badge tone={statusTone(order.status)}>
                                {STATUS_LABEL[order.status]}
                              </Badge>
                            </td>
                            {!isViewer && (
                              <td className="px-4 py-3.5 whitespace-nowrap text-right font-semibold text-ink tabular-nums">
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
                              <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs tabular-nums">
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
                                    className="rounded-xl bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                                  >
                                    {isThisPending ? "Guardando…" : STATUS_ACTION_LABEL[next]}
                                  </button>
                                )}
                                <Link
                                  href={`/orders/${order.id}`}
                                  className="rounded-xl border border-line bg-raised px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas"
                                >
                                  Ver detalle
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

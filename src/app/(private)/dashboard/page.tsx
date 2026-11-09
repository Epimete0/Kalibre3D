import Link from "next/link";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { getSessionMembershipState } from "@/lib/auth";
import { MATERIAL_LABEL, type Material } from "@/lib/catalog-presentation";
import { getDashboardOverview } from "@/lib/dashboard-queries";
import { GettingStartedCard } from "./GettingStartedCard";
import { formatMoney } from "@/lib/money-format";
import { CATEGORY_LABEL, type MoneyCategory } from "@/lib/money-presentation";
import {
  CHANNEL_LABEL,
  orderNumberLabel,
  STATUS_LABEL,
} from "@/lib/order-presentation";
import type { OrderChannel, OrderStatus } from "@/lib/order-status";
import { formatDay, formatMonth, formatMonthName } from "@/lib/date-labels";

export const dynamic = "force-dynamic";

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

type SearchParams = Promise<{ month?: string }>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const membershipState = await getSessionMembershipState();
  const active = membershipState.activeContext;
  if (!active) {
    return (
      <>
        <PageHeader
          title="Comienza en Kalibre"
          description="Crea tu propio taller o únete al de tu equipo con un código de invitación."
        />
        <Card className="max-w-2xl p-6">
          <h2 className="text-xl text-ink">Aún no tienes un taller activo</h2>
          <p className="mt-2 text-sm text-muted">
            Si este es tu negocio, créalo en un minuto. Si trabajas en el taller
            de otra persona, pídele su código de invitación.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <LinkButton href="/taller/nuevo">Crear mi taller</LinkButton>
            <LinkButton href="/join" variant="ghost">
              Tengo un código de invitación
            </LinkButton>
          </div>
        </Card>
      </>
    );
  }

  const resolvedParams = searchParams ? await searchParams : {};
  const centerName = membershipState.memberships.find(
    (membership) => membership.centerId === active.centerId
  )?.center.name;
  const name = membershipState.profile?.displayName?.split(" ")[0];

  const overview = await getDashboardOverview({ month: resolvedParams.month });
  const {
    currency,
    isManager,
    canOperate,
    isViewer,
    moneyView,
    pendingReceivableTotal,
    overdueOrders,
    upcomingOrders,
    statusCounts,
    lowSpools,
    lowStockProducts,
    gettingStarted,
  } = overview;

  const hasAlerts =
    overdueOrders.length > 0 ||
    lowSpools.length > 0 ||
    lowStockProducts.length > 0;

  const incomeChannelEntries = moneyView
    ? Object.entries(moneyView.summary.incomeByChannel).sort(
        (a, b) => b[1] - a[1]
      )
    : [];
  const expenseCategoryEntries = moneyView
    ? Object.entries(moneyView.summary.expenseByCategory).sort(
        (a, b) => b[1] - a[1]
      )
    : [];

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={name ? `Hola, ${name}` : "Hola"}
        description={
          centerName
            ? `Lo que tienes pendiente hoy y cómo va el mes en ${centerName}.`
            : "Lo que tienes pendiente hoy y cómo va el mes en tu taller."
        }
      >
        {canOperate && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/orders/new"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-primary-hover transition-colors touch-manipulation"
            >
              + Nueva venta
            </Link>
            <Link
              href="/quote"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-canvas transition-colors touch-manipulation"
            >
              Cotizar pieza
            </Link>
            {isManager && (
              <Link
                href="/money?new=expense"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-canvas transition-colors touch-manipulation"
              >
                + Registrar gasto
              </Link>
            )}
          </div>
        )}
      </PageHeader>

      {gettingStarted && <GettingStartedCard gettingStarted={gettingStarted} />}

      {/* Banda de alertas operativas: atrasados, poca bobina y stock bajo */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {overdueOrders.length > 0 && (
            <Card className="p-4 border-danger/45 bg-danger-soft/10 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-danger">
                  Pedidos atrasados
                </span>
                <Badge tone="danger">{overdueOrders.length}</Badge>
              </div>
              <p className="text-xs text-muted">
                Tienes {overdueOrders.length}{" "}
                {overdueOrders.length === 1
                  ? "pedido con fecha de entrega vencida."
                  : "pedidos con fecha de entrega vencida."}
              </p>
              <Link
                href="/orders?status=ACTIVE"
                className="text-xs font-semibold text-danger hover:underline"
              >
                Revisar pedidos atrasados →
              </Link>
            </Card>
          )}

          {lowSpools.length > 0 && (
            <Card className="p-4 border-warn/45 bg-warn-soft/10 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-warn">
                  Bobinas por acabarse
                </span>
                <Badge tone="warn">{lowSpools.length}</Badge>
              </div>
              <div className="space-y-1">
                {lowSpools.slice(0, 3).map((spool) => (
                  <Link
                    key={spool.id}
                    href={`/spools/${spool.id}`}
                    className="flex items-center justify-between text-xs text-ink hover:text-primary"
                  >
                    <span className="truncate font-medium">
                      {MATERIAL_LABEL[spool.material as Material] ?? spool.material}{" "}
                      · {spool.color}
                    </span>
                    <span className="shrink-0 font-bold text-warn">
                      {spool.remainingGrams} g
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/spools?onlyLow=1"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver bobinas bajas →
              </Link>
            </Card>
          )}

          {lowStockProducts.length > 0 && (
            <Card className="p-4 border-warn/45 bg-warn-soft/10 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-warn">
                  Piezas con stock bajo
                </span>
                <Badge tone="warn">{lowStockProducts.length}</Badge>
              </div>
              <div className="space-y-1">
                {lowStockProducts.slice(0, 3).map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/products/${prod.id}`}
                    className="flex items-center justify-between text-xs text-ink hover:text-primary"
                  >
                    <span className="truncate font-medium">{prod.name}</span>
                    <span className="shrink-0 font-bold text-warn">
                      {prod.currentStock} / mín. {prod.minStock}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/products"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Reponer en catálogo →
              </Link>
            </Card>
          )}
        </div>
      )}

      {/* Carga operativa por etapa del taller */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            { status: "QUOTED" as const, count: statusCounts.QUOTED, hint: "Por confirmar" },
            { status: "CONFIRMED" as const, count: statusCounts.CONFIRMED, hint: "En cola" },
            { status: "PRINTING" as const, count: statusCounts.PRINTING, hint: "En máquina" },
            { status: "READY" as const, count: statusCounts.READY, hint: "Para entrega" },
          ] as const
        ).map((item) => (
          <Link
            key={item.status}
            href={`/orders?status=${item.status}`}
            className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface p-3.5 sm:p-4 hover:border-primary/40 transition-colors flex flex-col justify-between gap-2.5"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <Badge tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Badge>
              <span className="truncate text-[11px] font-medium text-faint">
                {item.hint}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xl sm:text-3xl font-bold tabular-nums text-ink">
                {item.count}
              </span>
              <span className="text-xs font-semibold text-primary">
                Ver →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Panel financiero del mes para OWNER / ADMIN */}
      {isManager && moneyView && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Resumen de {formatMonth(moneyView.month)}
              </h2>
              <Link
                href={`/money?month=${moneyView.month}`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Ver todo en Dinero →
              </Link>
            </div>

            <div className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
              <Link
                href={`/dashboard?month=${moneyView.previousMonth}`}
                className="min-h-9 px-2.5 inline-flex shrink-0 items-center rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-canvas"
              >
                ← {formatMonthName(moneyView.previousMonth)}
              </Link>
              <span className="px-2.5 shrink-0 text-xs font-bold text-ink">
                {formatMonthName(moneyView.month)}
              </span>
              <Link
                href={`/dashboard?month=${moneyView.nextMonth}`}
                className="min-h-9 px-2.5 inline-flex shrink-0 items-center rounded-lg text-xs font-semibold text-muted hover:text-ink hover:bg-canvas"
              >
                {formatMonthName(moneyView.nextMonth)} →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            <Card className="p-4 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block truncate">
                Ingresos del mes
              </span>
              <span className="mt-1 block text-xl sm:text-2xl font-bold tabular-nums text-ok truncate">
                {formatMoney(moneyView.summary.income, currency)}
              </span>
            </Card>

            <Card className="p-4 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block truncate">
                Gastos del mes
              </span>
              <span className="mt-1 block text-xl sm:text-2xl font-bold tabular-nums text-danger truncate">
                {formatMoney(moneyView.summary.expense, currency)}
              </span>
            </Card>

            <Card className="p-4 min-w-0 border-primary/25">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block truncate">
                Ganancia neta
              </span>
              <span
                className={`mt-1 block text-xl sm:text-2xl font-bold tabular-nums truncate ${
                  moneyView.summary.profit >= 0 ? "text-ink" : "text-danger"
                }`}
              >
                {formatMoney(moneyView.summary.profit, currency)}
              </span>
            </Card>

            <Card className="p-4 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted block truncate">
                Por cobrar (pedidos activos)
              </span>
              <span className="mt-1 block text-xl sm:text-2xl font-bold tabular-nums text-warn truncate">
                {formatMoney(pendingReceivableTotal ?? 0, currency)}
              </span>
            </Card>
          </div>

          {/* Desglose por canal y por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  Ingresos por canal
                </h3>
                <span className="text-xs text-muted">
                  Total {formatMoney(moneyView.summary.income, currency)}
                </span>
              </div>

              {incomeChannelEntries.length === 0 ? (
                <p className="text-xs text-muted">
                  Sin ingresos registrados en este mes.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {incomeChannelEntries.map(([ch, amount]) => {
                    const pct =
                      moneyView.summary.income > 0
                        ? Math.round((amount / moneyView.summary.income) * 100)
                        : 0;
                    const label =
                      CHANNEL_LABEL[ch as OrderChannel] ?? ch;
                    return (
                      <div key={ch} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-ink">{label}</span>
                          <span className="font-semibold text-ink">
                            {formatMoney(amount, currency)}{" "}
                            <span className="text-muted font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-canvas overflow-hidden">
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

            <Card className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-ink">
                  Gastos por categoría
                </h3>
                <span className="text-xs text-muted">
                  Total {formatMoney(moneyView.summary.expense, currency)}
                </span>
              </div>

              {expenseCategoryEntries.length === 0 ? (
                <p className="text-xs text-muted">
                  Sin gastos registrados en este mes.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {expenseCategoryEntries.map(([cat, amount]) => {
                    const pct =
                      moneyView.summary.expense > 0
                        ? Math.round((amount / moneyView.summary.expense) * 100)
                        : 0;
                    const label =
                      CATEGORY_LABEL[cat as MoneyCategory] ?? cat;
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-ink">{label}</span>
                          <span className="font-semibold text-ink">
                            {formatMoney(amount, currency)}{" "}
                            <span className="text-muted font-normal">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-canvas overflow-hidden">
                          <div
                            className="h-full rounded-full bg-danger"
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
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pedidos atrasados */}
        <Card
          className={`p-4 sm:p-6 space-y-4 ${
            overdueOrders.length > 0 ? "border-danger/45 bg-danger-soft/10" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Pedidos atrasados
              </h2>
              <Badge tone={overdueOrders.length > 0 ? "danger" : "ok"}>
                {overdueOrders.length}
              </Badge>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver todos →
            </Link>
          </div>

          {overdueOrders.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted">
              No tienes pedidos atrasados. Todo está al día.
            </p>
          ) : (
            <div className="divide-y divide-line/70">
              {overdueOrders.slice(0, 6).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-ink group-hover:text-primary text-sm">
                        {orderNumberLabel(order.number)}
                      </span>
                      <Badge tone={statusTone(order.status)}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {order.customerName ?? "Sin cliente"} · {order.itemsSummary}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-danger block">
                      Debía entregarse: {formatDay(order.dueDate)}
                    </span>
                    {!isViewer && order.balance !== null && order.balance > 0 && (
                      <span className="text-[11px] font-medium text-warn">
                        Saldo: {formatMoney(order.balance, currency)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Próximos por entregar */}
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Por fabricar / entregar
              </h2>
              <Badge tone="neutral">{upcomingOrders.length}</Badge>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ir a pedidos →
            </Link>
          </div>

          {upcomingOrders.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted">
              No hay pedidos pendientes de entrega en este momento.
            </p>
          ) : (
            <div className="divide-y divide-line/70">
              {upcomingOrders.slice(0, 6).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-ink group-hover:text-primary text-sm">
                        {orderNumberLabel(order.number)}
                      </span>
                      <Badge tone={statusTone(order.status)}>
                        {STATUS_LABEL[order.status]}
                      </Badge>
                      <span className="text-xs text-muted">
                        · {CHANNEL_LABEL[order.channel]}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {order.customerName ?? "Sin cliente"} · {order.itemsSummary}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold text-ink block">
                      {order.dueDate ? `Entrega: ${formatDay(order.dueDate)}` : "Sin fecha"}
                    </span>
                    {!isViewer && order.expectedReceivable !== null && (
                      <span className="text-[11px] font-medium text-muted">
                        {formatMoney(order.expectedReceivable, currency)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

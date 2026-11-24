import Link from "next/link";
import {
  Badge,
  Card,
  LinkButton,
  PageHeader,
  segmentedTrackClass,
} from "@/components/ui";
import { canManageCatalog, getSessionMembershipState } from "@/lib/auth";
import { MATERIAL_LABEL, type Material } from "@/lib/catalog-presentation";
import { vatIncluded } from "@/lib/costing";
import { getDashboardOverview } from "@/lib/dashboard-queries";
import { getMonthlySalesEconomics } from "@/lib/insights-queries";
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

  const [overview, salesEconomics] = await Promise.all([
    getDashboardOverview({ month: resolvedParams.month }),
    canManageCatalog(active.role)
      ? getMonthlySalesEconomics({ month: resolvedParams.month })
      : Promise.resolve(null),
  ]);
  const {
    currency,
    vatPercent,
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
    <div className="space-y-3 pb-4 lg:space-y-3 lg:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl tracking-[-0.03em] text-ink font-bold leading-tight">
            {name ? `Hola, ${name}` : "Hola"}
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-snug">
            {centerName
              ? `Lo que tienes pendiente hoy y cómo va el mes en ${centerName}.`
              : "Lo que tienes pendiente hoy y cómo va el mes en tu taller."}
          </p>
        </div>
        {canOperate && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/orders/new"
              className="inline-flex lg:hidden min-h-10 items-center justify-center rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] hover:bg-primary-hover transition-colors touch-manipulation"
            >
              + Nueva venta
            </Link>
            <Link
              href="/quote"
              className="inline-flex min-h-10 lg:min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-ink hover:bg-raised/60 transition-colors touch-manipulation"
            >
              Cotizar pieza
            </Link>
            {isManager && (
              <Link
                href="/money?new=expense"
                className="inline-flex min-h-10 lg:min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-ink hover:bg-raised/60 transition-colors touch-manipulation"
              >
                + Registrar gasto
              </Link>
            )}
          </div>
        )}
      </div>

      {gettingStarted && <GettingStartedCard gettingStarted={gettingStarted} />}

      {/* Banda de alertas operativas: atrasados, poca bobina y stock bajo */}
      {hasAlerts && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 lg:gap-3">
          {overdueOrders.length > 0 && (
            <Card className="p-3 border-danger/45 bg-danger-soft/10 flex flex-col justify-between gap-1.5">
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
                href="/orders?status=ACTIVE&mode=due"
                className="text-xs font-semibold text-danger hover:underline"
              >
                Revisar pedidos atrasados →
              </Link>
            </Card>
          )}

          {lowSpools.length > 0 && (
            <Card className="p-3 border-warn/45 bg-warn-soft/10 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-warn">
                  Bobinas por acabarse
                </span>
                <Badge tone="warn">{lowSpools.length}</Badge>
              </div>
              <div className="space-y-1">
                {lowSpools.slice(0, 2).map((spool) => (
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
                href="/spools?low=1"
                className="text-xs font-semibold text-muted hover:text-ink underline decoration-line-strong underline-offset-4"
              >
                Ver bobinas bajas →
              </Link>
            </Card>
          )}

          {lowStockProducts.length > 0 && (
            <Card className="p-3 border-warn/45 bg-warn-soft/10 flex flex-col justify-between gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-warn">
                  Piezas con stock bajo
                </span>
                <Badge tone="warn">{lowStockProducts.length}</Badge>
              </div>
              <div className="space-y-1">
                {lowStockProducts.slice(0, 2).map((prod) => (
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
                className="text-xs font-semibold text-muted hover:text-ink underline decoration-line-strong underline-offset-4"
              >
                Reponer en catálogo →
              </Link>
            </Card>
          )}
        </div>
      )}

      {/* Carga operativa por etapa del taller */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
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
            className="min-w-0 overflow-hidden rounded-xl lg:rounded-2xl border border-line bg-surface px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-[0_1px_2px_rgba(28,29,33,0.04)] hover:border-line-strong transition-colors flex flex-col justify-between gap-1.5"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <Badge tone={statusTone(item.status)}>{STATUS_LABEL[item.status]}</Badge>
              <span className="truncate text-[11px] font-medium text-faint">
                {item.hint}
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl sm:text-2xl font-bold tabular-nums leading-none text-ink">
                {item.count}
              </span>
              <span className="text-xs font-semibold text-muted">
                Ver →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* Panel financiero del mes para OWNER / ADMIN */}
      {isManager && moneyView && (
        <div className="space-y-2.5 lg:space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-ink">
                Caja de {formatMonth(moneyView.month)}
              </h2>
              <Link
                href={`/money?month=${moneyView.month}&view=cash`}
                className="text-xs font-semibold text-muted hover:text-ink underline decoration-line-strong underline-offset-4"
              >
                Ver caja del mes →
              </Link>
            </div>

            <div className={segmentedTrackClass}>
              <Link
                href={`/dashboard?month=${moneyView.previousMonth}`}
                className="min-h-8 lg:min-h-7 px-2.5 inline-flex shrink-0 items-center rounded-xl text-xs font-semibold text-muted hover:text-ink hover:bg-canvas"
              >
                ← {formatMonthName(moneyView.previousMonth)}
              </Link>
              <span className="px-2 shrink-0 text-xs font-bold text-ink">
                {formatMonthName(moneyView.month)}
              </span>
              <Link
                href={`/dashboard?month=${moneyView.nextMonth}`}
                className="min-h-8 lg:min-h-7 px-2.5 inline-flex shrink-0 items-center rounded-xl text-xs font-semibold text-muted hover:text-ink hover:bg-canvas"
              >
                {formatMonthName(moneyView.nextMonth)} →
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface px-3.5 py-2 shadow-[0_1px_2px_rgba(28,29,33,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted">
            {salesEconomics && salesEconomics.summary.ordersCount > 0 ? (
              <span>
                <strong className="text-ink font-semibold">Ventas del mes:</strong>{" "}
                {formatMoney(salesEconomics.summary.grossRevenue, currency)} · Costo fabricación:{" "}
                <strong className="text-ink font-semibold">
                  {formatMoney(salesEconomics.summary.productionCost, currency)}
                </strong>{" "}
                · Ganancia estimada:{" "}
                <strong className={salesEconomics.summary.netProfit >= 0 ? "text-ok font-semibold" : "text-danger font-semibold"}>
                  {salesEconomics.summary.netProfit >= 0 ? "+" : ""}
                  {formatMoney(salesEconomics.summary.netProfit, currency)}
                </strong>
              </span>
            ) : (
              <span>
                Flujo de caja del taller: dinero disponible tras cobros, compras, gastos e impuestos.
              </span>
            )}
            <Link
              href={`/money?month=${moneyView.month}&view=accounts`}
              className="text-ink font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink shrink-0"
            >
              Ver cuentas (utilidades, IVA y costos) →
            </Link>
          </div>

          {(() => {
            const grossIncome = moneyView.summary.income;
            const vatAmount = vatIncluded(grossIncome, vatPercent);
            const netIncome = grossIncome - vatAmount;
            const netProfit = vatPercent > 0 ? netIncome - moneyView.summary.expense : moneyView.summary.profit;

            return (
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 lg:gap-3">
                <Card className="px-3.5 py-2.5 sm:py-3 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
                    Entró a caja
                  </span>
                  <span className="mt-0.5 block text-lg sm:text-xl font-bold tabular-nums leading-tight text-ok truncate">
                    {formatMoney(grossIncome, currency)}
                  </span>
                  {vatPercent > 0 && (
                    <span className="mt-0.5 block text-[11px] text-muted truncate">
                      Neto sin IVA: {formatMoney(netIncome, currency)}
                    </span>
                  )}
                </Card>

                <Card className="px-3.5 py-2.5 sm:py-3 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
                    Compras y gastos
                  </span>
                  <span className="mt-0.5 block text-lg sm:text-xl font-bold tabular-nums leading-tight text-ink truncate">
                    {formatMoney(moneyView.summary.expense, currency)}
                  </span>
                  {vatPercent > 0 && (
                    <span className="mt-0.5 block text-[11px] text-muted truncate">
                      IVA retenido: {formatMoney(vatAmount, currency)} ({vatPercent}%)
                    </span>
                  )}
                </Card>

                <Card className="px-3.5 py-2.5 sm:py-3 min-w-0 border-line-strong">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
                      Quedó en caja
                    </span>
                    <Badge tone={netProfit >= 0 ? "ok" : "danger"}>
                      {netProfit >= 0 ? "Saldo a favor" : "Déficit"}
                    </Badge>
                  </div>
                  <span
                    className={`mt-0.5 block text-lg sm:text-xl font-bold tabular-nums leading-tight truncate ${
                      netProfit >= 0 ? "text-ok" : "text-danger"
                    }`}
                  >
                    {formatMoney(netProfit, currency)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted truncate">
                    {vatPercent > 0
                      ? "Descontando compras, gastos e IVA"
                      : "Dinero disponible tras compras y gastos"}
                  </span>
                </Card>

                <Card className="px-3.5 py-2.5 sm:py-3 min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted block truncate">
                    Por cobrar
                  </span>
                  <span
                    className={`mt-0.5 block text-lg sm:text-xl font-bold tabular-nums leading-tight truncate ${
                      (pendingReceivableTotal ?? 0) > 0 ? "text-warn" : "text-ink"
                    }`}
                  >
                    {formatMoney(pendingReceivableTotal ?? 0, currency)}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted truncate">
                    En pedidos activos
                  </span>
                </Card>
              </div>
            );
          })()}

          {/* Desglose por canal y por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-3">
            <Card className="px-3.5 py-3 sm:px-4 space-y-2">
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
                <div className="space-y-2">
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
                        <div className="h-1.5 w-full rounded-full bg-canvas overflow-hidden">
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

            <Card className="px-3.5 py-3 sm:px-4 space-y-2">
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
                <div className="space-y-2">
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
                        <div className="h-1.5 w-full rounded-full bg-canvas overflow-hidden">
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
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 lg:gap-3">
        {/* Pedidos atrasados */}
        <Card
          className={`px-3.5 py-3 sm:px-4 space-y-2 ${
            overdueOrders.length > 0 ? "border-danger/45 bg-danger-soft/10" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-ink">
                Pedidos atrasados
              </h2>
              <Badge tone={overdueOrders.length > 0 ? "danger" : "ok"}>
                {overdueOrders.length}
              </Badge>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-muted hover:text-ink underline decoration-line-strong underline-offset-4"
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
              {overdueOrders.slice(0, 3).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
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
        <Card className="px-3.5 py-3 sm:px-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-ink">
                Por fabricar / entregar
              </h2>
              <Badge tone="neutral">{upcomingOrders.length}</Badge>
            </div>
            <Link
              href="/orders"
              className="text-xs font-semibold text-muted hover:text-ink underline decoration-line-strong underline-offset-4"
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
              {upcomingOrders.slice(0, 3).map((order) => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 group"
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

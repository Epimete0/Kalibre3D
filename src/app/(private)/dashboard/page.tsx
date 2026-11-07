import Link from "next/link";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { canManageCatalog, getSessionMembershipState } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { formatMoney } from "@/lib/money-format";
import { getMonthlyMoneyView } from "@/lib/money-queries";
import {
  CHANNEL_LABEL,
  orderNumberLabel,
  STATUS_LABEL,
} from "@/lib/order-presentation";
import { listOrders } from "@/lib/order-queries";
import type { OrderStatus } from "@/lib/order-status";

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

export default async function DashboardPage() {
  const membershipState = await getSessionMembershipState();
  const active = membershipState.activeContext;
  if (!active) {
    return (
      <>
        <PageHeader
          title="Comienza en Taller 3D"
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

  const centerName = membershipState.memberships.find(
    (membership) => membership.centerId === active.centerId
  )?.center.name;
  const name = membershipState.profile?.displayName?.split(" ")[0];
  const isManager = canManageCatalog(active.role);
  const canOperate =
    active.role === "OWNER" ||
    active.role === "ADMIN" ||
    active.role === "PROFESSIONAL";
  const isViewer = active.role === "VIEWER";

  const [activeOrders, settings, moneyView] = await Promise.all([
    listOrders({ status: "ACTIVE" }),
    getCenterSettings(),
    isManager ? getMonthlyMoneyView() : Promise.resolve(null),
  ]);

  const overdueOrders = activeOrders.filter((o) => o.isOverdue);
  const upcomingOrders = activeOrders.filter((o) => !o.isOverdue);
  const currency = settings.currency;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={name ? `Hola, ${name}` : "Hola"}
        description={
          centerName
            ? `Operación diaria de ${centerName}.`
            : "Operación diaria de tu taller."
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

      {/* Resumen mensual rápido para OWNER / ADMIN */}
      {isManager && moneyView && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Ingresos ({moneyView.month})
              </span>
              <Link href="/money" className="text-xs font-semibold text-primary hover:underline">
                Ver detalle →
              </Link>
            </div>
            <span className="mt-1 block text-xl sm:text-2xl font-bold text-ok">
              {formatMoney(moneyView.summary.income, currency)}
            </span>
          </Card>

          <Card className="p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Gastos ({moneyView.month})
            </span>
            <span className="mt-1 block text-xl sm:text-2xl font-bold text-danger">
              {formatMoney(moneyView.summary.expense, currency)}
            </span>
          </Card>

          <Card className="p-4 border-primary/25">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted block">
              Ganancia del mes
            </span>
            <span
              className={`mt-1 block text-xl sm:text-2xl font-bold ${
                moneyView.summary.profit >= 0 ? "text-ink" : "text-danger"
              }`}
            >
              {formatMoney(moneyView.summary.profit, currency)}
            </span>
          </Card>
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
                      Debía entregarse: {order.dueDate}
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
                      {order.dueDate ? `Entrega: ${order.dueDate}` : "Sin fecha"}
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

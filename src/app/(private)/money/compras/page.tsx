import Link from "next/link";
import { NoPermission } from "@/components/NoPermission";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { formatDay, formatMonth, formatMonthName } from "@/lib/date-labels";
import { getMonthlyPurchases } from "@/lib/insights-queries";
import { formatMoney } from "@/lib/money-format";
import { CATEGORY_LABEL, type MoneyCategory } from "@/lib/money-presentation";
import { MoneyTabs } from "../MoneyTabs";

export const metadata = { title: "Compras | Kalibre" };
export const dynamic = "force-dynamic";

export default async function PurchasesPage(props: { searchParams?: Promise<{ month?: string }> }) {
  const auth = await requireAuthContext();
  if (!canManageCatalog(auth.role)) {
    return <NoPermission action="ver las compras del taller" backHref="/dashboard" backLabel="Volver al inicio" />;
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const [view, settings] = await Promise.all([getMonthlyPurchases({ month: searchParams.month }), getCenterSettings()]);
  const { summary } = view;
  const currency = settings.currency;
  const label = (category: string) => CATEGORY_LABEL[category as MoneyCategory] ?? category;

  return (
    <div className="space-y-5 pb-20">
      <PageHeader title="Dinero del taller" description="En qué gastaste este mes: filamento, repuestos, envíos y más." />
      <MoneyTabs active="compras" month={view.month} />

      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface p-2">
        <Link href={`/money/compras?month=${view.previousMonth}`} className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas">
          ← {formatMonthName(view.previousMonth)}
        </Link>
        <span className="text-sm font-bold capitalize text-ink">{formatMonth(view.month)}</span>
        <Link href={`/money/compras?month=${view.nextMonth}`} className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas">
          {formatMonthName(view.nextMonth)} →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Compras del mes</p>
          <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{formatMoney(summary.total, currency)}</p>
          <p className="mt-1 text-xs text-muted">Sin contar devoluciones a clientes ni lo anulado.</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Bobinas agregadas</p>
          {summary.spoolsAdded.count > 0 ? (
            <>
              <p className="mt-1 text-2xl font-bold text-ink tabular-nums">
                {summary.spoolsAdded.count} {summary.spoolsAdded.count === 1 ? "bobina" : "bobinas"} ·{" "}
                {(summary.spoolsAdded.grams / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg
              </p>
              {summary.spoolsAdded.averagePerKg !== null && (
                <p className="mt-1 text-xs text-muted">
                  Promedio pagado: {formatMoney(summary.spoolsAdded.averagePerKg, currency)} por kilo.
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Ninguna este mes.</p>
          )}
        </Card>
      </div>

      {summary.byCategory.length > 0 && (
        <Card className="p-4 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Por tipo de compra</h2>
          {summary.byCategory.map((row) => (
            <div key={row.category} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-ink">
                {label(row.category)} <span className="text-xs text-muted">({row.count})</span>
              </span>
              <span className="font-semibold text-ink tabular-nums">{formatMoney(row.total, currency)}</span>
            </div>
          ))}
        </Card>
      )}

      {summary.purchases.length === 0 ? (
        <EmptyState
          title="Todavía no hay compras este mes"
          description="Cuando compres filamento, repuestos o pagues envíos, anótalo con «Registrar gasto» en Resumen. Las bobinas que compres se anotan solas al agregarlas."
        >
          <Link
            href={`/money?month=${view.month}&new=expense`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            + Registrar gasto
          </Link>
        </EmptyState>
      ) : (
        <Card className="p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Detalle</h2>
          <ul className="mt-2 divide-y divide-line/70">
            {summary.purchases.map((purchase) => (
              <li key={purchase.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${purchase.voided ? "text-muted line-through" : "text-ink"}`}>
                    {label(purchase.category)}
                    {purchase.voided && <Badge tone="neutral">Anulada</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDay(purchase.occurredOn)}
                    {purchase.notes ? ` · ${purchase.notes}` : ""}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${purchase.voided ? "text-muted line-through" : "text-danger"}`}>
                  −{formatMoney(purchase.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            ¿Anotaste como compra una bobina que ya tenías? Anúlala desde{" "}
            <Link href={`/money?month=${view.month}`} className="font-semibold text-primary hover:underline">
              Resumen
            </Link>{" "}
            con el botón «Anular».
          </p>
        </Card>
      )}
    </div>
  );
}

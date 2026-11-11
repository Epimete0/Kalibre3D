import Link from "next/link";
import { NoPermission } from "@/components/NoPermission";
import { EmptyState, PageHeader } from "@/components/ui";
import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { formatMonth, formatMonthName } from "@/lib/date-labels";
import { getProductProfitability } from "@/lib/insights-queries";
import { MoneyTabs } from "../MoneyTabs";
import { ProfitabilityControls } from "./ProfitabilityControls";

export const metadata = { title: "Rentabilidad | Kalibre" };
export const dynamic = "force-dynamic";

export default async function ProfitabilityPage(props: {
  searchParams?: Promise<{ month?: string; periodo?: string }>;
}) {
  const auth = await requireAuthContext();
  if (!canManageCatalog(auth.role)) {
    return (
      <NoPermission
        action="ver la rentabilidad del taller"
        backHref="/dashboard"
        backLabel="Volver al inicio"
      />
    );
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const all = searchParams.periodo === "todo";
  const [view, settings] = await Promise.all([
    getProductProfitability({ month: searchParams.month, all }),
    getCenterSettings(),
  ]);
  const currency = settings.currency;
  const { nav } = view;
  const anyEstimatedToday = view.rows.some((row) => row.unitsEstimatedToday > 0);
  const anyWithoutCost = view.rows.some((row) => row.unitsWithoutCost > 0);

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Dinero del taller"
        description="Qué pieza te deja más ganancia, después de comisiones, envíos y costos de fabricación."
      />
      <MoneyTabs active="rentabilidad" month={all ? undefined : nav.month} />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface p-2">
        {all ? (
          <span className="px-2 text-sm font-bold text-ink">Desde que empezaste</span>
        ) : (
          <div className="flex items-center gap-1">
            <Link
              href={`/money/rentabilidad?month=${nav.previousMonth}`}
              className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas"
            >
              ← {formatMonthName(nav.previousMonth)}
            </Link>
            <span className="text-sm font-bold capitalize text-ink">
              {formatMonth(nav.month)}
            </span>
            <Link
              href={`/money/rentabilidad?month=${nav.nextMonth}`}
              className="min-h-10 rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas"
            >
              {formatMonthName(nav.nextMonth)} →
            </Link>
          </div>
        )}
        <Link
          href={all ? "/money/rentabilidad" : "/money/rentabilidad?periodo=todo"}
          className="min-h-10 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas"
        >
          {all ? "Ver por mes" : "Ver desde que empezaste"}
        </Link>
      </div>

      {view.rows.length === 0 ? (
        <EmptyState
          title="Todavía no hay ventas en este período"
          description="Cuando vendas piezas, aquí verás cuál te deja más ganancia. Si eliges la pieza desde tu catálogo al vender, el cálculo es más preciso."
        >
          <Link
            href="/orders/new"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            + Registrar venta
          </Link>
        </EmptyState>
      ) : (
        <ProfitabilityControls
          rows={view.rows}
          totals={view.totals}
          ordersCount={view.ordersCount}
          currency={currency}
          vatPercent={settings.vatPercent}
          anyEstimatedToday={anyEstimatedToday}
          anyWithoutCost={anyWithoutCost}
        />
      )}
    </div>
  );
}

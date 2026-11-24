import { NoPermission } from "@/components/NoPermission";
import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { getMonthlySalesEconomics } from "@/lib/insights-queries";
import { getMonthlyMoneyView } from "@/lib/money-queries";
import { MoneyControls } from "./MoneyControls";

export const metadata = {
  title: "Dinero | Kalibre",
};

export const dynamic = "force-dynamic";

export default async function MoneyPage(props: {
  searchParams?: Promise<{ month?: string; new?: string; view?: string }>;
}) {
  const auth = await requireAuthContext();
  if (!canManageCatalog(auth.role)) {
    return (
      <NoPermission
        action="consultar ni administrar el dinero del taller"
        backHref="/dashboard"
        backLabel="Volver al inicio"
      />
    );
  }

  const searchParams = props.searchParams ? await props.searchParams : {};
  const [view, settings, salesEconomics] = await Promise.all([
    getMonthlyMoneyView({ month: searchParams.month }),
    getCenterSettings(),
    getMonthlySalesEconomics({ month: searchParams.month }),
  ]);

  const initialMode =
    searchParams.new === "expense"
      ? "EXPENSE"
      : searchParams.new === "income"
        ? "INCOME"
        : null;

  const initialView: "accounts" | "cash" =
    searchParams.view === "cash" || initialMode !== null ? "cash" : "accounts";

  return (
    <div className="pb-20 lg:pb-4">
      <MoneyControls
        key={`${view.month}-${initialMode ?? "none"}-${initialView}`}
        view={view}
        salesSummary={salesEconomics.summary}
        costBreakdown={salesEconomics.costBreakdown}
        orderAccounts={salesEconomics.orderAccounts}
        currency={settings.currency}
        vatPercent={settings.vatPercent}
        initialMode={initialMode}
        initialView={initialView}
      />
    </div>
  );
}

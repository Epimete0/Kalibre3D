import { NoPermission } from "@/components/NoPermission";
import { PageHeader } from "@/components/ui";
import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { getMonthlyMoneyView } from "@/lib/money-queries";
import { MoneyControls } from "./MoneyControls";

export const metadata = {
  title: "Dinero | Kalibre",
};

export default async function MoneyPage(props: {
  searchParams?: Promise<{ month?: string; new?: string }>;
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
  const [view, settings] = await Promise.all([
    getMonthlyMoneyView({ month: searchParams.month }),
    getCenterSettings(),
  ]);

  const initialMode =
    searchParams.new === "expense"
      ? "EXPENSE"
      : searchParams.new === "income"
        ? "INCOME"
        : null;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Dinero del taller"
        description="Ingresos, gastos, ganancia mensual real y movimientos por canal y categoría."
      />

      <MoneyControls
        key={`${view.month}-${initialMode ?? "none"}`}
        view={view}
        currency={settings.currency}
        initialMode={initialMode}
      />
    </div>
  );
}

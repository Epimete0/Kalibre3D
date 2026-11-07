import { PageHeader } from "@/components/ui";
import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listCustomers } from "@/lib/customer-queries";
import { CreateCustomerBar, CustomerListTable, CustomerSearchAndFilters } from "./ClientControls";

export const metadata = {
  title: "Clientes | Kalibre",
};

export default async function ClientsPage(props: {
  searchParams?: Promise<{ q?: string; all?: string }>;
}) {
  const { role } = await requireAuthContext();
  const settings = await getCenterSettings();
  const searchParams = props.searchParams ? await props.searchParams : {};

  const query = searchParams?.q ?? "";
  const includeInactive = searchParams?.all === "true";

  const customers = await listCustomers({
    search: query,
    includeInactive,
  });

  const canManage = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";
  const canDelete = role === "OWNER" || role === "ADMIN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestión y directorio de clientes del taller para seguimiento de pedidos y saldos."
      />

      {canManage && <CreateCustomerBar />}

      <CustomerSearchAndFilters
        currentSearch={query}
        includeInactive={includeInactive}
      />

      <CustomerListTable
        customers={customers}
        currency={settings.currency}
        canManage={canManage}
        canDelete={canDelete}
      />
    </div>
  );
}

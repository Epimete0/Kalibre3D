import { notFound } from "next/navigation";
import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { getCustomerDetail } from "@/lib/customer-queries";
import { CustomerDetailHeader, CustomerOrdersTable } from "./ClientDetailControls";

export const metadata = {
  title: "Ficha del cliente | Kalibre",
};

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { role } = await requireAuthContext();
  const { id } = await props.params;

  const [customer, settings] = await Promise.all([
    getCustomerDetail(id),
    getCenterSettings(),
  ]);

  if (!customer) {
    notFound();
  }

  const canManage = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";
  const canDelete = role === "OWNER" || role === "ADMIN";

  return (
    <div className="space-y-6">
      <CustomerDetailHeader
        customer={customer}
        currency={settings.currency}
        canManage={canManage}
        canDelete={canDelete}
      />

      <CustomerOrdersTable
        customer={customer}
        currency={settings.currency}
      />
    </div>
  );
}

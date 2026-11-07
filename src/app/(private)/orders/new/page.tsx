import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireOperationalContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listCustomers } from "@/lib/customer-queries";
import { resolveNewOrderOperation } from "@/lib/order-operation";
import { listProducts } from "@/lib/product-queries";
import { NewOrderForm } from "./NewOrderForm";

export const metadata = {
  title: "Nueva venta / pedido | saas3d",
};

export default async function NewOrderPage(props: {
  searchParams?: Promise<{ op?: string }>;
}) {
  await requireOperationalContext();
  const searchParams = props.searchParams ? await props.searchParams : {};
  const operation = await resolveNewOrderOperation(searchParams.op);

  if (operation.redirect) {
    redirect(`/orders/new?op=${operation.operationId}`);
  }

  if (operation.kind === "EXISTING_OWN") {
    redirect(`/orders`);
  }

  const [products, customers, settings] = await Promise.all([
    listProducts({ includeInactive: false }),
    listCustomers({ includeInactive: false }),
    getCenterSettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva venta"
        description="Registra una venta rápida en el acto o un pedido por encargo para fabricar."
      />

      <NewOrderForm
        operationId={operation.operationId}
        products={products}
        customers={customers}
        settings={{
          currency: settings.currency,
          mlCommissionPercent: settings.mlCommissionPercent,
          mlDefaultShippingCost: settings.mlDefaultShippingCost,
        }}
      />
    </div>
  );
}

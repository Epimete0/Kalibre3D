import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOperationalContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listCustomers } from "@/lib/customer-queries";
import { LAST_CHANNEL_COOKIE, parseLastChannel } from "@/lib/last-channel";
import { resolveNewOrderOperation } from "@/lib/order-operation";
import { listProducts } from "@/lib/product-queries";
import { NewOrderForm } from "./NewOrderForm";

export const metadata = {
  title: "Nueva venta / pedido | Kalibre",
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

  const initialChannel = parseLastChannel((await cookies()).get(LAST_CHANNEL_COOKIE)?.value);

  const [products, customers, settings] = await Promise.all([
    listProducts({ includeInactive: false }),
    listCustomers({ includeInactive: false }),
    getCenterSettings(),
  ]);

  return (
    <div className="space-y-4 pb-24 lg:pb-6">
      <h1 className="sr-only">Nueva venta</h1>

      <NewOrderForm
        operationId={operation.operationId}
        products={products}
        customers={customers}
        settings={{
          currency: settings.currency,
          mlCommissionPercent: settings.mlCommissionPercent,
          mlDefaultShippingCost: settings.mlDefaultShippingCost,
          enableClients: settings.enableClients,
          enableProductStock: settings.enableProductStock,
        }}
        initialChannel={initialChannel}
      />
    </div>
  );
}

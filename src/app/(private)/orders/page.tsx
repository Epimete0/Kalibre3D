import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listOrders } from "@/lib/order-queries";
import { OrderListControls } from "./OrderListControls";

export const metadata = {
  title: "Pedidos y Ventas | saas3d",
};

export default async function OrdersPage() {
  const { role } = await requireAuthContext();
  const [orders, settings] = await Promise.all([
    listOrders(),
    getCenterSettings(),
  ]);

  const canManage = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";
  const isViewer = role === "VIEWER";

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Pedidos y Ventas"
        description="Historial de ventas entregadas y pedidos por encargo."
      >
        {canManage && (
          <Link
            href="/orders/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-primary-hover transition-colors touch-manipulation"
          >
            + Nueva venta
          </Link>
        )}
      </PageHeader>

      <OrderListControls
        orders={orders}
        currency={settings.currency}
        canManage={canManage}
        isViewer={isViewer}
      />
    </div>
  );
}

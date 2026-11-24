import Link from "next/link";
import { requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { todayInTimeZone } from "@/lib/money-summary";
import { parseOrderListParams } from "@/lib/order-grouping";
import { listOrders } from "@/lib/order-queries";
import { OrderListControls } from "./OrderListControls";

export const metadata = {
  title: "Pedidos y Ventas | Kalibre",
};

export default async function OrdersPage(props: {
  searchParams?: Promise<{ status?: string; mode?: string; month?: string }>;
}) {
  const [{ role, timeZone }, searchParams] = await Promise.all([
    requireAuthContext(),
    props.searchParams ?? Promise.resolve({}),
  ]);
  const [orders, settings] = await Promise.all([
    listOrders(),
    getCenterSettings(),
  ]);

  const { initialStatus, initialDateMode, initialMonth } = parseOrderListParams(searchParams);
  const todayStr = todayInTimeZone(new Date(), timeZone ?? "America/Santiago");
  const canManage = role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";
  const isViewer = role === "VIEWER";

  return (
    <div className="space-y-4 pb-20">
      <h1 className="sr-only">Pedidos y Ventas</h1>
      {canManage && (
        <div className="flex items-center justify-end lg:hidden">
          <Link
            href="/orders/new"
            className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] hover:bg-primary-hover transition-colors touch-manipulation"
          >
            + Nueva venta
          </Link>
        </div>
      )}

      <OrderListControls
        key={`${initialStatus}-${initialDateMode}-${initialMonth}`}
        orders={orders}
        currency={settings.currency}
        todayStr={todayStr}
        initialStatus={initialStatus}
        initialDateMode={initialDateMode}
        initialMonth={initialMonth}
        canManage={canManage}
        isViewer={isViewer}
      />
    </div>
  );
}

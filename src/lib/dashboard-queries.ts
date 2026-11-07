import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import type { Currency } from "@/lib/money-format";
import { getMonthlyMoneyView, type MonthlyMoneyView } from "@/lib/money-queries";
import { listOrders, type OrderListItem } from "@/lib/order-queries";
import { listProducts, type ProductListItem } from "@/lib/product-queries";
import { listSpools, type SpoolListItem } from "@/lib/spool-queries";

export type DashboardActiveStatusCounts = {
  QUOTED: number;
  CONFIRMED: number;
  PRINTING: number;
  READY: number;
};

export type DashboardOverview = {
  currency: Currency;
  isManager: boolean;
  canOperate: boolean;
  isViewer: boolean;
  moneyView: MonthlyMoneyView | null;
  pendingReceivableTotal: number | null;
  overdueOrders: OrderListItem[];
  upcomingOrders: OrderListItem[];
  statusCounts: DashboardActiveStatusCounts;
  lowSpools: SpoolListItem[];
  lowStockProducts: ProductListItem[];
};

export async function getDashboardOverview(options?: {
  month?: string;
}): Promise<DashboardOverview> {
  const { role } = await requireAuthContext();
  const isManager = canManageCatalog(role);
  const canOperate =
    role === "OWNER" || role === "ADMIN" || role === "PROFESSIONAL";
  const isViewer = role === "VIEWER";

  const [activeOrders, settings, moneyView, spoolsView, products] =
    await Promise.all([
      listOrders({ status: "ACTIVE" }),
      canOperate ? getCenterSettings() : Promise.resolve(null),
      isManager
        ? getMonthlyMoneyView({ month: options?.month })
        : Promise.resolve(null),
      canOperate
        ? listSpools({ includeInactive: false, onlyLow: true })
        : Promise.resolve(null),
      canOperate
        ? listProducts({ includeInactive: false })
        : Promise.resolve(null),
    ]);

  const overdueOrders = activeOrders.filter((o) => o.isOverdue);
  const upcomingOrders = activeOrders.filter((o) => !o.isOverdue);

  const statusCounts: DashboardActiveStatusCounts = {
    QUOTED: 0,
    CONFIRMED: 0,
    PRINTING: 0,
    READY: 0,
  };

  let pendingReceivable = 0;

  for (const order of activeOrders) {
    if (order.status === "QUOTED") statusCounts.QUOTED += 1;
    else if (order.status === "CONFIRMED") statusCounts.CONFIRMED += 1;
    else if (order.status === "PRINTING") statusCounts.PRINTING += 1;
    else if (order.status === "READY") statusCounts.READY += 1;

    if (isManager && order.balance !== null && order.balance > 0) {
      pendingReceivable += order.balance;
    }
  }

  const lowSpools = spoolsView ? spoolsView.spools.filter((s) => s.isLow) : [];
  const lowStockProducts = products ? products.filter((p) => p.isLowStock) : [];

  return {
    currency: (settings?.currency as Currency | undefined) ?? "CLP",
    isManager,
    canOperate,
    isViewer,
    moneyView,
    pendingReceivableTotal: isManager ? pendingReceivable : null,
    overdueOrders,
    upcomingOrders,
    statusCounts,
    lowSpools,
    lowStockProducts,
  };
}

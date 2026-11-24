/**
 * Agrupación y etiquetas de fecha para el listado de pedidos.
 * Módulo puro: opera sobre fechas de calendario resueltas en la zona horaria del taller (AAAA-MM-DD).
 */
import { formatDay, formatMonth } from "./date-labels";
import { isValidMonth } from "./money-summary";
import type { OrderListFilterStatus } from "./order-queries";
import { ORDER_STATUSES } from "./order-status";

export type OrderDateMode = "created" | "due";

const ALLOWED_STATUS_FILTERS = new Set<string>(["ALL", "ACTIVE", ...ORDER_STATUSES]);

/** Valida los parámetros de URL iniciales para /orders evitando valores inválidos. */
export function parseOrderListParams(params?: {
  status?: string;
  mode?: string;
  month?: string;
}): {
  initialStatus: OrderListFilterStatus;
  initialDateMode: OrderDateMode;
  initialMonth: string;
} {
  const initialStatus: OrderListFilterStatus =
    params?.status && ALLOWED_STATUS_FILTERS.has(params.status)
      ? (params.status as OrderListFilterStatus)
      : "ALL";
  const initialDateMode: OrderDateMode = params?.mode === "due" ? "due" : "created";
  const initialMonth = params?.month && isValidMonth(params.month) ? params.month : "ALL";
  return { initialStatus, initialDateMode, initialMonth };
}

const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

function parseCalendarDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

/** Suma o resta días a una fecha de calendario AAAA-MM-DD sin depender de la zona horaria del host. */
export function shiftCalendarDay(dateStr: string, deltaDays: number): string {
  const dt = parseCalendarDate(dateStr);
  if (!dt) return dateStr;
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

/** Formatea el encabezado de un grupo diario ("Hoy · 24 nov 2026", "Ayer · 23 nov 2026", "Sáb 21 nov 2026"). */
export function formatRelativeDayHeader(dateStr: string | null, todayStr: string): string {
  if (!dateStr) return "Sin fecha de entrega";
  const dayLabel = formatDay(dateStr);
  if (dateStr === todayStr) return `Hoy · ${dayLabel}`;
  if (dateStr === shiftCalendarDay(todayStr, -1)) return `Ayer · ${dayLabel}`;
  if (dateStr === shiftCalendarDay(todayStr, 1)) return `Mañana · ${dayLabel}`;

  const dt = parseCalendarDate(dateStr);
  if (!dt) return dayLabel;
  const weekday = WEEKDAYS_SHORT[dt.getUTCDay()];
  return `${weekday} · ${dayLabel}`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

export type OrderMonthOption = {
  month: string;
  label: string;
  count: number;
};

/** Obtiene los meses disponibles según el modo de fecha activo, del más reciente al más antiguo. */
export function extractOrderMonths(
  orders: readonly { createdOn: string; dueDate: string | null }[],
  mode: OrderDateMode
): OrderMonthOption[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const raw = mode === "created" ? order.createdOn : order.dueDate;
    if (!raw || raw.length < 7) continue;
    const month = raw.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, count]) => ({
      month,
      label: capitalize(formatMonth(month)),
      count,
    }));
}

export type OrderGroupable = {
  number: number;
  createdOn: string;
  dueDate: string | null;
  isOverdue: boolean;
  expectedReceivable: number | null;
};

export type OrderDateGroup<T extends OrderGroupable> = {
  dateKey: string | null;
  label: string;
  isOverdueGroup: boolean;
  count: number;
  totalReceivable: number | null;
  orders: T[];
};

/**
 * Agrupa pedidos por día:
 * - "created": del día más reciente al más antiguo (dentro de cada día por número descendente).
 * - "due": cronológico ascendente (atrasados y entregas más próximas primero, "Sin fecha de entrega" al final).
 */
export function groupOrdersByDate<T extends OrderGroupable>(
  orders: readonly T[],
  options: {
    mode: OrderDateMode;
    todayStr: string;
    hideTotals?: boolean;
  }
): OrderDateGroup<T>[] {
  const map = new Map<string, { dateKey: string | null; orders: T[] }>();

  for (const order of orders) {
    const dateKey = options.mode === "created" ? order.createdOn : order.dueDate;
    const bucketKey = dateKey ?? "__NO_DATE__";
    const bucket = map.get(bucketKey);
    if (bucket) {
      bucket.orders.push(order);
    } else {
      map.set(bucketKey, { dateKey, orders: [order] });
    }
  }

  const groups = [...map.values()];

  groups.sort((a, b) => {
    if (a.dateKey === b.dateKey) return 0;
    if (a.dateKey === null) return 1;
    if (b.dateKey === null) return -1;
    return options.mode === "created"
      ? b.dateKey.localeCompare(a.dateKey)
      : a.dateKey.localeCompare(b.dateKey);
  });

  return groups.map(({ dateKey, orders: bucketOrders }) => {
    const sorted = [...bucketOrders].sort((a, b) => {
      if (options.mode === "due" && a.isOverdue !== b.isOverdue) {
        return a.isOverdue ? -1 : 1;
      }
      return b.number - a.number;
    });

    const isOverdueGroup = sorted.some((o) => o.isOverdue);

    let totalReceivable: number | null = options.hideTotals ? null : 0;
    if (totalReceivable !== null) {
      for (const o of sorted) {
        if (o.expectedReceivable === null) {
          totalReceivable = null;
          break;
        }
        totalReceivable += o.expectedReceivable;
      }
    }

    return {
      dateKey,
      label: formatRelativeDayHeader(dateKey, options.todayStr),
      isOverdueGroup,
      count: sorted.length,
      totalReceivable,
      orders: sorted,
    };
  });
}

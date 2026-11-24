import { describe, expect, it } from "vitest";
import {
  extractOrderMonths,
  formatRelativeDayHeader,
  groupOrdersByDate,
  parseOrderListParams,
  shiftCalendarDay,
} from "./order-grouping";

describe("order-grouping", () => {
  it("desplaza días calendario cruzando cambio de mes y año sin depender de zona horaria", () => {
    expect(shiftCalendarDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftCalendarDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftCalendarDay("2026-11-24", -1)).toBe("2026-11-23");
    expect(shiftCalendarDay("invalida", -1)).toBe("invalida");
  });

  it("formatea encabezados relativos (Hoy, Ayer, Mañana, día de semana y sin entrega)", () => {
    const today = "2026-11-24"; // Martes
    expect(formatRelativeDayHeader("2026-11-24", today)).toBe("Hoy · 24 nov 2026");
    expect(formatRelativeDayHeader("2026-11-23", today)).toBe("Ayer · 23 nov 2026");
    expect(formatRelativeDayHeader("2026-11-25", today)).toBe("Mañana · 25 nov 2026");
    expect(formatRelativeDayHeader("2026-11-21", today)).toBe("Sáb · 21 nov 2026");
    expect(formatRelativeDayHeader(null, today)).toBe("Sin fecha de entrega");
  });

  it("extrae los meses disponibles ordenados del más reciente al más antiguo", () => {
    const sample = [
      { createdOn: "2026-10-15", dueDate: "2026-11-02" },
      { createdOn: "2026-11-24", dueDate: null },
      { createdOn: "2026-11-03", dueDate: "2026-11-10" },
    ];

    expect(extractOrderMonths(sample, "created")).toEqual([
      { month: "2026-11", label: "Noviembre 2026", count: 2 },
      { month: "2026-10", label: "Octubre 2026", count: 1 },
    ]);

    expect(extractOrderMonths(sample, "due")).toEqual([
      { month: "2026-11", label: "Noviembre 2026", count: 2 },
    ]);
  });

  it("agrupa por fecha de pedido del día más reciente al más antiguo y suma montos", () => {
    const orders = [
      { id: "1", number: 1, createdOn: "2026-11-20", dueDate: null, isOverdue: false, expectedReceivable: 5000 },
      { id: "2", number: 2, createdOn: "2026-11-24", dueDate: "2026-11-28", isOverdue: false, expectedReceivable: 12000 },
      { id: "3", number: 5, createdOn: "2026-11-24", dueDate: null, isOverdue: false, expectedReceivable: 8000 },
    ];

    const groups = groupOrdersByDate(orders, { mode: "created", todayStr: "2026-11-24" });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      dateKey: "2026-11-24",
      label: "Hoy · 24 nov 2026",
      count: 2,
      totalReceivable: 20000,
    });
    expect(groups[0].orders.map((o) => o.number)).toEqual([5, 2]);
    expect(groups[1].dateKey).toBe("2026-11-20");
  });

  it("oculta totales de grupo para VIEWER o cuando falta el monto", () => {
    const orders = [
      { id: "1", number: 1, createdOn: "2026-11-24", dueDate: null, isOverdue: false, expectedReceivable: 10000 },
    ];
    const hidden = groupOrdersByDate(orders, {
      mode: "created",
      todayStr: "2026-11-24",
      hideTotals: true,
    });
    expect(hidden[0].totalReceivable).toBeNull();

    const viewerOrders = [
      { id: "1", number: 1, createdOn: "2026-11-24", dueDate: null, isOverdue: false, expectedReceivable: null },
    ];
    const viewerGroups = groupOrdersByDate(viewerOrders, {
      mode: "created",
      todayStr: "2026-11-24",
    });
    expect(viewerGroups[0].totalReceivable).toBeNull();
  });

  it("agrupa por fecha de entrega en orden cronológico ascendente dejando sin fecha al final", () => {
    const orders = [
      { id: "a", number: 4, createdOn: "2026-11-24", dueDate: null, isOverdue: false, expectedReceivable: 5000 },
      { id: "b", number: 3, createdOn: "2026-11-20", dueDate: "2026-11-26", isOverdue: false, expectedReceivable: 7000 },
      { id: "c", number: 2, createdOn: "2026-11-18", dueDate: "2026-11-22", isOverdue: true, expectedReceivable: 9000 },
    ];

    const groups = groupOrdersByDate(orders, { mode: "due", todayStr: "2026-11-24" });
    expect(groups.map((g) => g.dateKey)).toEqual(["2026-11-22", "2026-11-26", null]);
    expect(groups[0].isOverdueGroup).toBe(true);
    expect(groups[1].isOverdueGroup).toBe(false);
    expect(groups[2].label).toBe("Sin fecha de entrega");
  });

  it("valida parámetros de URL para /orders y cae a valores seguros ante entradas inválidas", () => {
    expect(parseOrderListParams({ status: "ACTIVE", mode: "due", month: "2026-11" })).toEqual({
      initialStatus: "ACTIVE",
      initialDateMode: "due",
      initialMonth: "2026-11",
    });

    expect(parseOrderListParams({ status: "PRINTING" })).toEqual({
      initialStatus: "PRINTING",
      initialDateMode: "created",
      initialMonth: "ALL",
    });

    expect(parseOrderListParams({ status: "HACK", mode: "otro", month: "2026-99" })).toEqual({
      initialStatus: "ALL",
      initialDateMode: "created",
      initialMonth: "ALL",
    });
  });
});

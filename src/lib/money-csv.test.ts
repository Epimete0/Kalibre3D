import { describe, expect, it } from "vitest";
import {
  accountsCsvFilename,
  buildMonthlyAccountsCsv,
  buildMonthlyMoneyCsv,
  escapeCsvCell,
  formatCsvAmount,
  moneyCsvFilename,
  sanitizeCsvText,
} from "./money-csv";
import type { MonthlyMoneyView } from "./money-queries";

describe("money-csv", () => {
  it("neutraliza intentos de inyección de fórmulas en notas o motivos", () => {
    expect(sanitizeCsvText("=SUM(A1:A5)")).toBe("'=SUM(A1:A5)");
    expect(sanitizeCsvText("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeCsvText("-1000")).toBe("'-1000");
    expect(sanitizeCsvText("@IMPORTXML()")).toBe("'@IMPORTXML()");
    expect(sanitizeCsvText("Compra de 2 bobinas PETG")).toBe("Compra de 2 bobinas PETG");
  });

  it("escapa celdas con punto y coma, comas o comillas", () => {
    expect(escapeCsvCell("Texto; con punto y coma")).toBe('"Texto; con punto y coma"');
    expect(escapeCsvCell('Bobina "negra"')).toBe('"Bobina ""negra"""');
    expect(escapeCsvCell("Simple")).toBe("Simple");
  });

  it("formatea montos en unidades mayores según la moneda", () => {
    expect(formatCsvAmount(8990, "CLP")).toBe("8990");
    expect(formatCsvAmount(1250, "USD")).toBe("12.50");
  });

  it("genera el CSV mensual con BOM UTF-8, signos y estado de anulación", () => {
    const view: MonthlyMoneyView = {
      month: "2026-11",
      previousMonth: "2026-10",
      nextMonth: "2026-12",
      todayStr: "2026-11-15",
      summary: {
        income: 8990,
        expense: 15000,
        profit: -6010,
        incomeByChannel: { MERCADOLIBRE: 8990 },
        expenseByCategory: { FILAMENT: 15000 },
      },
      transactions: [
        {
          id: "tx-1",
          type: "INCOME",
          category: "ORDER_PAYMENT",
          amount: 8990,
          method: "MERCADOLIBRE",
          occurredOn: "2026-11-14",
          notes: "Emblema Hilux",
          orderId: "ord-1",
          orderNumber: 7,
          orderChannel: "MERCADOLIBRE",
          createdAt: new Date("2026-11-14T15:00:00Z"),
          voidedAt: null,
          voidReason: null,
        },
        {
          id: "tx-2",
          type: "EXPENSE",
          category: "FILAMENT",
          amount: 15000,
          method: "TRANSFER",
          occurredOn: "2026-11-10",
          notes: "=1+1",
          orderId: null,
          orderNumber: null,
          orderChannel: null,
          createdAt: new Date("2026-11-10T12:00:00Z"),
          voidedAt: null,
          voidReason: null,
        },
        {
          id: "tx-3",
          type: "EXPENSE",
          category: "SHIPPING",
          amount: 3500,
          method: "CASH",
          occurredOn: "2026-11-09",
          notes: "Envío duplicado",
          orderId: null,
          orderNumber: null,
          orderChannel: null,
          createdAt: new Date("2026-11-09T12:00:00Z"),
          voidedAt: new Date("2026-11-09T13:00:00Z"),
          voidReason: "Cargado dos veces",
        },
      ],
    };

    const csv = buildMonthlyMoneyCsv(view, "CLP");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(moneyCsvFilename("2026-11")).toBe("kalibre-movimientos-2026-11.csv");

    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("Fecha;Tipo;Categoría;Canal;Pedido;Método de pago;Monto;Monto con signo;Moneda;Estado;Notas;Motivo de anulación");
    expect(lines[1]).toContain("2026-11-14;Ingreso;Cobro de venta;Mercado Libre;Pedido #7;Mercado Libre;8990;8990;CLP;Vigente;Emblema Hilux;");
    expect(lines[2]).toContain("2026-11-10;Gasto;Filamento;;;Transferencia;15000;-15000;CLP;Vigente;'=1+1;");
    expect(lines[3]).toContain("2026-11-09;Gasto;Envíos;;;Efectivo;3500;0;CLP;Anulado;Envío duplicado;Cargado dos veces");
  });

  it("genera el CSV mensual de cuentas con fila de totales y neutralización anti-fórmulas", () => {
    expect(accountsCsvFilename("2026-11")).toBe("kalibre-cuentas-2026-11.csv");

    const csv = buildMonthlyAccountsCsv(
      [
        {
          id: "o1",
          number: 14,
          createdOn: "2026-11-24",
          channel: "MERCADOLIBRE",
          customerName: "=EVIL()",
          itemsSummary: "2× Soporte gamer",
          units: 2,
          grossRevenue: 11900,
          vatAmount: 1900,
          netRevenue: 10000,
          productionCost: 2500,
          profit: 7500,
          marginPercent: 75,
          unitsWithoutCost: 0,
          unitsEstimatedToday: 0,
        },
      ],
      "CLP",
      19
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("Fecha;Pedido;Canal;Cliente;Piezas;Unidades;Venta neta ML/desc;IVA (19%);Neto taller;Costo fabricación;Utilidad estimada;Margen (%);Moneda;Observación de costo");
    expect(lines[1]).toContain("2026-11-24;Pedido #14;Mercado Libre;'=EVIL();2× Soporte gamer;2;11900;1900;10000;2500;7500;75%;CLP;Costo registrado al vender");
    expect(lines[2]).toContain("TOTAL;1 pedido(s);;;;2;11900;1900;10000;2500;7500;75%;CLP;");
  });
});

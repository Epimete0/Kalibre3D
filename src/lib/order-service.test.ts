import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireOperationalContext, requireCatalogContext } = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      createMany: vi.fn(),
    },
    orderEvent: {
      create: vi.fn(),
    },
    customer: {
      create: vi.fn(),
    },
    moneyTransaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(async (callback: (innerTx: typeof tx) => Promise<unknown>) => callback(tx)),
      ...tx,
    },
    requireOperationalContext: vi.fn().mockResolvedValue({
      userId: "user-1",
      centerId: "center-1",
      role: "OWNER",
      timeZone: "America/Santiago",
    }),
    requireCatalogContext: vi.fn().mockResolvedValue({
      userId: "user-1",
      centerId: "center-1",
      role: "OWNER",
      timeZone: "America/Santiago",
    }),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireOperationalContext, requireCatalogContext }));

import {
  changeOrderStatus,
  createOrder,
  registerPayment,
  returnOrder,
  voidMoneyTransaction,
} from "./order-service";

const VALID_OP_ID = "22222222-2222-4222-8222-222222222222";

describe("order-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.$queryRaw.mockResolvedValue([{ max: 0 }]);
    prisma.order.findUnique.mockResolvedValue(null);
    prisma.moneyTransaction.findUnique.mockResolvedValue(null);
    prisma.moneyTransaction.create.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ id: "tx-1", ...(args.data as object) })
    );
    prisma.order.create.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ id: "order-1", number: 1, ...(args.data as object) })
    );
    prisma.customer.create.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ id: "cust-new-1", ...(args.data as object) })
    );
  });

  describe("createOrder", () => {
    it("crea una venta rápida entregada con número correlativo y evento CREATED", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ max: 4 }]);

      const result = await createOrder({
        operationId: VALID_OP_ID,
        kind: "QUICK_SALE",
        channel: "IN_PERSON",
        items: [
          {
            description: "Emblema Hilux",
            qty: 2,
            unitPrice: 5000,
            material: "PLA",
            colorsCount: 1,
          },
        ],
        discount: 1000,
        initialPayment: {
          amount: 9000,
          method: "CASH",
        },
      });

      expect(requireOperationalContext).toHaveBeenCalled();
      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          centerId: "center-1",
          number: 5,
          operationId: VALID_OP_ID,
          kind: "QUICK_SALE",
          channel: "IN_PERSON",
          status: "DELIVERED",
          version: 1,
          discount: 1000,
          total: 9000,
          deliveredAt: expect.any(Date),
          createdByUserId: "user-1",
        }),
      });

      expect(prisma.orderItem.createMany).toHaveBeenCalledWith({
        data: [
          {
            centerId: "center-1",
            orderId: "order-1",
            position: 1,
            productId: null,
            description: "Emblema Hilux",
            qty: 2,
            unitPrice: 5000,
            material: "PLA",
            grams: null,
            colorsCount: 1,
          },
        ],
      });

      expect(prisma.orderEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          centerId: "center-1",
          orderId: "order-1",
          version: 1,
          fromStatus: null,
          toStatus: "DELIVERED",
          actorUserId: "user-1",
        }),
      });

      expect(prisma.moneyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          centerId: "center-1",
          type: "INCOME",
          category: "ORDER_PAYMENT",
          amount: 9000,
          method: "CASH",
          orderId: "order-1",
          recordedByUserId: "user-1",
        }),
      });

      expect(result).toEqual({ id: "order-1", number: 5 });
    });

    it("crea un pedido por encargo con cliente al vuelo (D7) y fecha de entrega", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ max: 0 }]);

      const result = await createOrder({
        operationId: VALID_OP_ID,
        kind: "ORDER",
        channel: "WHATSAPP",
        status: "CONFIRMED",
        dueDate: "2026-11-15",
        newCustomerName: "Juan Pérez",
        newCustomerPhone: "+56911223344",
        items: [
          {
            description: "Letrero LED",
            qty: 1,
            unitPrice: 25000,
            colorsCount: 2,
          },
        ],
      });

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          centerId: "center-1",
          createdByUserId: "user-1",
          name: "Juan Pérez",
          phone: "+56911223344",
          instagram: null,
          notes: null,
          active: true,
        },
      });

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: "cust-new-1",
          kind: "ORDER",
          status: "CONFIRMED",
          deliveredAt: null,
          dueDate: new Date("2026-11-15T00:00:00.000Z"),
          total: 25000,
        }),
      });

      expect(result).toEqual({ id: "order-1", number: 1 });
    });

    it("soporta ventas de Mercado Libre con comisión y envío (D4)", async () => {
      await createOrder({
        operationId: VALID_OP_ID,
        kind: "QUICK_SALE",
        channel: "MERCADOLIBRE",
        mlOrderRef: "MLB-987654321",
        mlCommission: 1708,
        mlShippingCost: 799,
        items: [
          {
            description: "Pieza ML",
            qty: 1,
            unitPrice: 8990,
          },
        ],
        initialPayment: {
          amount: 6483, // Neto ML: 8990 - 1708 - 799 = 6483
          method: "MERCADOLIBRE",
        },
      });

      expect(prisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: "MERCADOLIBRE",
          total: 8990,
          mlCommission: 1708,
          mlShippingCost: 799,
          mlOrderRef: "MLB-987654321",
        }),
      });

      expect(prisma.moneyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 6483,
          method: "MERCADOLIBRE",
        }),
      });
    });

    it("es idempotente: si el operationId ya existe, retorna el pedido existente", async () => {
      prisma.order.findUnique.mockResolvedValueOnce({
        id: "existing-order-id",
        number: 8,
      });

      const result = await createOrder({
        operationId: VALID_OP_ID,
        kind: "QUICK_SALE",
        channel: "IN_PERSON",
        items: [{ description: "Pieza", qty: 1, unitPrice: 1000 }],
      });

      expect(prisma.order.findUnique).toHaveBeenCalled();
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "existing-order-id", number: 8 });
    });

    it("rechaza pedidos sin piezas", async () => {
      await expect(
        createOrder({
          operationId: VALID_OP_ID,
          kind: "QUICK_SALE",
          channel: "IN_PERSON",
          items: [],
        })
      ).rejects.toThrow("El pedido debe contener al menos una pieza.");
    });

    it("rechaza descuento negativo", async () => {
      await expect(
        createOrder({
          operationId: VALID_OP_ID,
          kind: "QUICK_SALE",
          channel: "IN_PERSON",
          discount: -500,
          items: [{ description: "Pieza", qty: 1, unitPrice: 1000 }],
        })
      ).rejects.toThrow("El descuento debe ser mayor o igual a 0.");
    });
  });

  describe("changeOrderStatus", () => {
    const ORDER_UUID = "11111111-1111-4111-8111-111111111111";

    it("actualiza el estado, incrementa la versión y registra OrderEvent", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: ORDER_UUID,
          centerId: "center-1",
          status: "CONFIRMED",
          version: 1,
          deliveredAt: null,
        },
      ]);

      const result = await changeOrderStatus({
        orderId: ORDER_UUID,
        expectedVersion: 1,
        to: "PRINTING",
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { centerId_id: { centerId: "center-1", id: ORDER_UUID } },
        data: {
          status: "PRINTING",
          version: 2,
          deliveredAt: null,
        },
      });
      expect(prisma.orderEvent.create).toHaveBeenCalledWith({
        data: {
          centerId: "center-1",
          orderId: ORDER_UUID,
          version: 2,
          fromStatus: "CONFIRMED",
          toStatus: "PRINTING",
          actorUserId: "user-1",
        },
      });
      expect(result).toEqual({ id: ORDER_UUID, status: "PRINTING", version: 2 });
    });

    it("fija deliveredAt cuando el estado pasa a DELIVERED", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: ORDER_UUID,
          centerId: "center-1",
          status: "READY",
          version: 3,
          deliveredAt: null,
        },
      ]);

      const result = await changeOrderStatus({
        orderId: ORDER_UUID,
        expectedVersion: 3,
        to: "DELIVERED",
      });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { centerId_id: { centerId: "center-1", id: ORDER_UUID } },
        data: {
          status: "DELIVERED",
          version: 4,
          deliveredAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ id: ORDER_UUID, status: "DELIVERED", version: 4 });
    });

    it("rechaza cuando la versión esperada no coincide (concurrencia)", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: ORDER_UUID,
          centerId: "center-1",
          status: "PRINTING",
          version: 2,
          deliveredAt: null,
        },
      ]);

      await expect(
        changeOrderStatus({
          orderId: ORDER_UUID,
          expectedVersion: 1,
          to: "READY",
        })
      ).rejects.toThrow("El pedido fue modificado por otra persona o pestaña. Recarga la página para ver el estado actual.");
    });

    it("rechaza una transición inválida del ciclo de vida", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: ORDER_UUID,
          centerId: "center-1",
          status: "DELIVERED",
          version: 2,
          deliveredAt: new Date(),
        },
      ]);

      await expect(
        changeOrderStatus({
          orderId: ORDER_UUID,
          expectedVersion: 2,
          to: "PRINTING",
        })
      ).rejects.toThrow('No se puede cambiar el estado de "Entregado" a "Imprimiendo".');
    });

    it("rechaza cambiar directamente a RETURNED sin flujo de devolución", async () => {
      await expect(
        changeOrderStatus({
          orderId: ORDER_UUID,
          expectedVersion: 2,
          to: "RETURNED",
        })
      ).rejects.toThrow("Para registrar una devolución utiliza la opción de devolución con reembolso.");
    });

    it("rechaza cuando el pedido no existe en el taller", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        changeOrderStatus({
          orderId: ORDER_UUID,
          expectedVersion: 1,
          to: "CONFIRMED",
        })
      ).rejects.toThrow("El pedido no existe o no pertenece a este taller.");
    });
  });

  describe("registerPayment", () => {
    const ORDER_UUID = "11111111-1111-4111-8111-111111111111";

    it("registra un cobro con requireCatalogContext y bloqueo del pedido", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: ORDER_UUID, status: "CONFIRMED" }]);

      const result = await registerPayment({
        orderId: ORDER_UUID,
        operationId: VALID_OP_ID,
        amount: 5000,
        method: "TRANSFER",
        notes: "Abono 50%",
      });

      expect(requireCatalogContext).toHaveBeenCalled();
      expect(prisma.moneyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          centerId: "center-1",
          operationId: VALID_OP_ID,
          type: "INCOME",
          category: "ORDER_PAYMENT",
          amount: 5000,
          method: "TRANSFER",
          orderId: ORDER_UUID,
          notes: "Abono 50%",
        }),
      });
      expect(result).toEqual({ id: "tx-1", amount: 5000 });
    });

    it("es idempotente si el operationId ya fue registrado", async () => {
      prisma.moneyTransaction.findUnique.mockResolvedValueOnce({
        id: "tx-existing",
        amount: 5000,
        type: "INCOME",
        category: "ORDER_PAYMENT",
        orderId: ORDER_UUID,
      });

      const result = await registerPayment({
        orderId: ORDER_UUID,
        operationId: VALID_OP_ID,
        amount: 5000,
        method: "TRANSFER",
      });

      expect(result).toEqual({ id: "tx-existing", amount: 5000 });
      expect(prisma.moneyTransaction.create).not.toHaveBeenCalled();
    });

    it("rechaza un operationId ya usado en un movimiento de otro pedido", async () => {
      prisma.moneyTransaction.findUnique.mockResolvedValueOnce({
        id: "tx-otro",
        amount: 5000,
        type: "INCOME",
        category: "ORDER_PAYMENT",
        orderId: "00000000-0000-4000-8000-000000000999",
      });

      await expect(
        registerPayment({ orderId: ORDER_UUID, operationId: VALID_OP_ID, amount: 5000, method: "TRANSFER" })
      ).rejects.toThrow("Esta operación ya se usó para otro movimiento");
      expect(prisma.moneyTransaction.create).not.toHaveBeenCalled();
    });

    it("rechaza cobros sobre un pedido cancelado", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: ORDER_UUID, status: "CANCELED" }]);

      await expect(
        registerPayment({
          orderId: ORDER_UUID,
          operationId: VALID_OP_ID,
          amount: 5000,
          method: "CASH",
        })
      ).rejects.toThrow("No se puede registrar un cobro en un pedido cancelado.");
    });
  });

  describe("voidMoneyTransaction", () => {
    const TX_UUID = "33333333-3333-4333-8333-333333333333";

    it("anula un movimiento activo con motivo obligatorio (D5)", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: TX_UUID, voidedAt: null }]);

      const result = await voidMoneyTransaction({
        transactionId: TX_UUID,
        reason: "Monto duplicado",
      });

      expect(requireCatalogContext).toHaveBeenCalled();
      expect(prisma.moneyTransaction.updateMany).toHaveBeenCalledWith({
        where: { centerId: "center-1", id: TX_UUID },
        data: {
          voidedAt: expect.any(Date),
          voidedByUserId: "user-1",
          voidReason: "Monto duplicado",
        },
      });
      expect(result.id).toBe(TX_UUID);
    });

    it("rechaza anular un movimiento que ya estaba anulado", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: TX_UUID, voidedAt: new Date() }]);

      await expect(
        voidMoneyTransaction({
          transactionId: TX_UUID,
          reason: "Reintento",
        })
      ).rejects.toThrow("Este movimiento ya fue anulado.");
    });
  });

  describe("returnOrder", () => {
    const ORDER_UUID = "11111111-1111-4111-8111-111111111111";

    it("pasa el pedido de DELIVERED a RETURNED, crea evento y gasto REFUNDS en una transacción (D6)", async () => {
      const deliveredDate = new Date("2026-11-05T10:00:00Z");
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: ORDER_UUID,
          status: "DELIVERED",
          version: 2,
          deliveredAt: deliveredDate,
        },
      ]);

      const result = await returnOrder({
        orderId: ORDER_UUID,
        expectedVersion: 2,
        operationId: VALID_OP_ID,
        refundAmount: 6483,
        method: "MERCADOLIBRE",
        notes: "Devolución ML",
      });

      expect(requireCatalogContext).toHaveBeenCalled();
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { centerId_id: { centerId: "center-1", id: ORDER_UUID } },
        data: {
          status: "RETURNED",
          version: 3,
          deliveredAt: deliveredDate,
        },
      });
      expect(prisma.orderEvent.create).toHaveBeenCalledWith({
        data: {
          centerId: "center-1",
          orderId: ORDER_UUID,
          version: 3,
          fromStatus: "DELIVERED",
          toStatus: "RETURNED",
          actorUserId: "user-1",
        },
      });
      expect(prisma.moneyTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          centerId: "center-1",
          operationId: VALID_OP_ID,
          type: "EXPENSE",
          category: "REFUNDS",
          amount: 6483,
          method: "MERCADOLIBRE",
          orderId: ORDER_UUID,
          notes: "Devolución ML",
        }),
      });
      expect(result).toEqual({
        orderId: ORDER_UUID,
        status: "RETURNED",
        version: 3,
        transactionId: "tx-1",
      });
    });

    it("rechaza devolver un pedido que no está en DELIVERED", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: ORDER_UUID,
          status: "READY",
          version: 2,
          deliveredAt: null,
        },
      ]);

      await expect(
        returnOrder({
          orderId: ORDER_UUID,
          expectedVersion: 2,
          operationId: VALID_OP_ID,
          refundAmount: 5000,
          method: "TRANSFER",
        })
      ).rejects.toThrow('Solo se puede registrar una devolución sobre un pedido entregado (estado actual: "Listo").');
    });
  });
});

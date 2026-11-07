import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext, requireOperationalContext } from "@/lib/auth";
import { PAYMENT_METHODS } from "@/lib/money-presentation";
import { todayInTimeZone } from "@/lib/money-summary";
import { STATUS_LABEL } from "@/lib/order-presentation";
import { canTransition, ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { orderTotal } from "@/lib/order-totals";
import { prisma } from "@/lib/prisma";

const orderItemInputSchema = z.object({
  productId: z.string().uuid().nullable().optional().default(null),
  description: z
    .string({ error: "La descripción de la pieza es obligatoria." })
    .trim()
    .min(1, "La descripción de la pieza es obligatoria.")
    .max(200, "La descripción es demasiado larga (máximo 200 caracteres)."),
  qty: z.coerce
    .number({ error: "La cantidad debe ser un número entero mayor a 0." })
    .int("La cantidad debe ser un número entero.")
    .min(1, "La cantidad debe ser mayor a 0."),
  unitPrice: z.coerce
    .number({ error: "El precio unitario debe ser mayor o igual a 0." })
    .int("El precio unitario debe ser un número entero.")
    .min(0, "El precio unitario debe ser mayor o igual a 0."),
  material: z.string().trim().nullable().optional().default(null),
  grams: z.coerce.number().int().min(0).nullable().optional().default(null),
  colorsCount: z.coerce
    .number()
    .int()
    .min(1, "La cantidad de colores debe ser al menos 1.")
    .optional()
    .default(1),
});

export const createOrderSchema = z.object({
  operationId: z.string().uuid("Identificador de operación no válido."),
  kind: z.enum(["QUICK_SALE", "ORDER"], {
    error: "El tipo de venta no es válido.",
  }),
  channel: z.enum(
    ["WHATSAPP", "INSTAGRAM", "IN_PERSON", "MERCADOLIBRE", "DIGITAL", "OTHER"],
    { error: "El canal no es válido." }
  ),
  status: z
    .enum(["QUOTED", "CONFIRMED", "PRINTING", "READY", "DELIVERED", "CANCELED", "RETURNED"])
    .optional(),
  customerId: z.string().uuid().nullable().optional().default(null),
  newCustomerName: z.string().trim().optional(),
  newCustomerPhone: z.string().trim().optional(),
  newCustomerInstagram: z.string().trim().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de entrega debe tener formato AAAA-MM-DD.")
    .nullable()
    .optional(),
  discount: z.coerce
    .number({ error: "El descuento debe ser un número entero mayor o igual a 0." })
    .int("El descuento debe ser un número entero.")
    .min(0, "El descuento debe ser mayor o igual a 0.")
    .default(0),
  mlOrderRef: z.string().trim().nullable().optional().default(null),
  mlCommission: z.coerce
    .number()
    .int()
    .min(0, "La comisión de Mercado Libre debe ser mayor o igual a 0.")
    .default(0),
  mlShippingCost: z.coerce
    .number()
    .int()
    .min(0, "El costo de envío de Mercado Libre debe ser mayor o igual a 0.")
    .default(0),
  notes: z.string().trim().max(1000, "Las notas no pueden superar 1000 caracteres.").nullable().optional().default(null),
  items: z
    .array(orderItemInputSchema)
    .min(1, "El pedido debe contener al menos una pieza."),
  initialPayment: z
    .object({
      amount: z.coerce.number().int().min(0),
      method: z.enum(["TRANSFER", "CASH", "MERCADOPAGO", "MERCADOLIBRE", "OTHER"]),
    })
    .optional(),
});

function handleZodError(error: unknown): never {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    throw new DomainError(firstIssue.message);
  }
  throw error;
}

export async function createOrder(input: unknown) {
  const context = await requireOperationalContext();
  const { centerId, userId, timeZone } = context;

  let data: z.infer<typeof createOrderSchema>;
  try {
    data = createOrderSchema.parse(input);
  } catch (error) {
    handleZodError(error);
  }

  // Idempotencia: si ya existe por operationId en el taller, retornar directamente
  const existing = await prisma.order.findUnique({
    where: { centerId_operationId: { centerId, operationId: data.operationId } },
    select: { id: true, number: true },
  });
  if (existing) {
    return existing;
  }

  const total = orderTotal(data.items, data.discount);

  // Determinar estado inicial
  const status =
    data.status ?? (data.kind === "QUICK_SALE" ? "DELIVERED" : "CONFIRMED");
  const deliveredAt = status === "DELIVERED" ? new Date() : null;

  const result = await prisma.$transaction(async (tx) => {
    // Cerrojo determinístico a nivel de taller para correlativo consecutivo
    await tx.$executeRaw`SELECT 1 FROM "Center" WHERE "id" = ${centerId}::uuid FOR UPDATE`;

    const maxResult = await tx.$queryRaw<{ max: number | null }[]>`
      SELECT COALESCE(MAX("number"), 0)::int as max FROM "Order" WHERE "centerId" = ${centerId}::uuid
    `;
    const nextNumber = (maxResult[0]?.max ?? 0) + 1;

    // Crear cliente al vuelo si se proporcionó un nombre y no hay customerId
    let finalCustomerId = data.customerId;
    if (!finalCustomerId && data.newCustomerName && data.newCustomerName.trim().length > 0) {
      const cleanInsta = data.newCustomerInstagram?.replace(/^@+/, "").trim() || null;
      const createdCustomer = await tx.customer.create({
        data: {
          centerId,
          createdByUserId: userId,
          name: data.newCustomerName.trim(),
          phone: data.newCustomerPhone?.trim() || null,
          instagram: cleanInsta,
          notes: null,
          active: true,
        },
      });
      finalCustomerId = createdCustomer.id;
    }

    const orderDueDate = data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null;

    const order = await tx.order.create({
      data: {
        centerId,
        number: nextNumber,
        operationId: data.operationId,
        kind: data.kind,
        customerId: finalCustomerId,
        channel: data.channel,
        status,
        version: 1,
        dueDate: orderDueDate,
        discount: data.discount,
        total,
        mlOrderRef: data.mlOrderRef,
        mlCommission: data.mlCommission,
        mlShippingCost: data.mlShippingCost,
        notes: data.notes,
        createdByUserId: userId,
        deliveredAt,
      },
    });

    // Guardar piezas del pedido
    await tx.orderItem.createMany({
      data: data.items.map((item, index) => ({
        centerId,
        orderId: order.id,
        position: index + 1,
        productId: item.productId,
        description: item.description,
        qty: item.qty,
        unitPrice: item.unitPrice,
        material: item.material,
        grams: item.grams,
        colorsCount: item.colorsCount,
      })),
    });

    // Registrar evento inicial de creación
    await tx.orderEvent.create({
      data: {
        centerId,
        orderId: order.id,
        version: 1,
        fromStatus: null,
        toStatus: status,
        actorUserId: userId,
      },
    });

    // Si hay pago inicial o cobro de venta rápida, registrar en MoneyTransaction
    if (data.initialPayment && data.initialPayment.amount > 0) {
      const tz = timeZone ?? "America/Santiago";
      const todayDateStr = todayInTimeZone(new Date(), tz);
      await tx.moneyTransaction.create({
        data: {
          centerId,
          operationId: randomUUID(),
          type: "INCOME",
          category: "ORDER_PAYMENT",
          amount: data.initialPayment.amount,
          occurredOn: new Date(`${todayDateStr}T00:00:00.000Z`),
          method: data.initialPayment.method,
          orderId: order.id,
          recordedByUserId: userId,
        },
      });
    }

    return { id: order.id, number: order.number };
  });

  return result;
}

export const changeOrderStatusSchema = z.object({
  orderId: z.string({ error: "Identificador de pedido inválido." }).uuid("Identificador de pedido inválido."),
  expectedVersion: z.coerce
    .number({ error: "La versión del pedido es inválida." })
    .int("La versión del pedido debe ser un entero.")
    .min(1, "La versión del pedido debe ser al menos 1."),
  to: z.enum(ORDER_STATUSES, {
    error: "El estado de destino no es válido.",
  }),
});

export type ChangeOrderStatusInput = z.input<typeof changeOrderStatusSchema>;

export async function changeOrderStatus(
  input: ChangeOrderStatusInput
): Promise<{ id: string; status: OrderStatus; version: number }> {
  const { centerId, userId } = await requireOperationalContext();
  const parsed = changeOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Datos de cambio de estado inválidos.");
  }

  const { orderId, expectedVersion, to } = parsed.data;
  if (to === "RETURNED") {
    throw new DomainError("Para registrar una devolución utiliza la opción de devolución con reembolso.");
  }

  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        centerId: string;
        status: string;
        version: number;
        deliveredAt: Date | null;
      }>
    >`
      SELECT id, "centerId", status, version, "deliveredAt"
      FROM "Order"
      WHERE "centerId" = ${centerId}::uuid AND id = ${orderId}::uuid
      FOR UPDATE
    `;

    const order = rows[0];
    if (!order) {
      throw new DomainError("El pedido no existe o no pertenece a este taller.");
    }

    if (order.version !== expectedVersion) {
      throw new DomainError(
        "El pedido fue modificado por otra persona o pestaña. Recarga la página para ver el estado actual."
      );
    }

    const currentStatus = order.status as OrderStatus;
    if (!canTransition(currentStatus, to)) {
      throw new DomainError(
        `No se puede cambiar el estado de "${STATUS_LABEL[currentStatus]}" a "${STATUS_LABEL[to]}".`
      );
    }

    const nextVersion = order.version + 1;
    const nextDeliveredAt =
      to === "DELIVERED"
        ? new Date()
        : currentStatus === "DELIVERED"
          ? order.deliveredAt
          : null;

    await tx.order.update({
      where: { centerId_id: { centerId, id: orderId } },
      data: {
        status: to,
        version: nextVersion,
        deliveredAt: nextDeliveredAt,
      },
    });

    await tx.orderEvent.create({
      data: {
        centerId,
        orderId,
        version: nextVersion,
        fromStatus: currentStatus,
        toStatus: to,
        actorUserId: userId,
      },
    });

    return { id: orderId, status: to, version: nextVersion };
  });
}

export const registerPaymentSchema = z.object({
  orderId: z.string({ error: "Identificador de pedido inválido." }).uuid("Identificador de pedido inválido."),
  operationId: z.string({ error: "Identificador de operación inválido." }).uuid("Identificador de operación inválido."),
  amount: z.coerce
    .number({ error: "El monto del cobro debe ser mayor a 0." })
    .int("El monto del cobro debe ser un número entero.")
    .min(1, "El monto del cobro debe ser mayor a 0."),
  method: z.enum(PAYMENT_METHODS, { error: "El método de pago no es válido." }),
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD.")
    .optional(),
  notes: z.string().trim().max(1000, "Las notas no pueden superar 1000 caracteres.").nullable().optional().default(null),
});

export type RegisterPaymentInput = z.input<typeof registerPaymentSchema>;

export async function registerPayment(
  input: RegisterPaymentInput
): Promise<{ id: string; amount: number }> {
  const { centerId, userId, timeZone } = await requireCatalogContext();
  const parsed = registerPaymentSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Datos de cobro inválidos.");
  }
  const data = parsed.data;
  const tz = timeZone ?? "America/Santiago";
  const dateStr = data.occurredOn ?? todayInTimeZone(new Date(), tz);

  // Idempotencia previa fuera de la transacción si ya existe
  const existingPre = await prisma.moneyTransaction.findUnique({
    where: { centerId_operationId: { centerId, operationId: data.operationId } },
    select: { id: true, amount: true },
  });
  if (existingPre) {
    return existingPre;
  }

  return await prisma.$transaction(async (tx) => {
    // Bloquear el pedido para serializar cobros concurrentes del mismo pedido
    const orderRows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status
      FROM "Order"
      WHERE "centerId" = ${centerId}::uuid AND id = ${data.orderId}::uuid
      FOR UPDATE
    `;
    const order = orderRows[0];
    if (!order) {
      throw new DomainError("El pedido no existe o no pertenece a este taller.");
    }
    if (order.status === "CANCELED") {
      throw new DomainError("No se puede registrar un cobro en un pedido cancelado.");
    }

    // Revalidar idempotencia dentro del bloqueo
    const existingInTx = await tx.moneyTransaction.findUnique({
      where: { centerId_operationId: { centerId, operationId: data.operationId } },
      select: { id: true, amount: true },
    });
    if (existingInTx) {
      return existingInTx;
    }

    const txRow = await tx.moneyTransaction.create({
      data: {
        centerId,
        operationId: data.operationId,
        type: "INCOME",
        category: "ORDER_PAYMENT",
        amount: data.amount,
        occurredOn: new Date(`${dateStr}T00:00:00.000Z`),
        method: data.method,
        orderId: data.orderId,
        notes: data.notes,
        recordedByUserId: userId,
      },
    });
    return { id: txRow.id, amount: txRow.amount };
  });
}

export const voidMoneyTransactionSchema = z.object({
  transactionId: z.string({ error: "Identificador de movimiento inválido." }).uuid("Identificador de movimiento inválido."),
  reason: z
    .string({ error: "Debes indicar el motivo de la anulación." })
    .trim()
    .min(1, "Debes indicar el motivo de la anulación.")
    .max(300, "El motivo de la anulación no puede superar 300 caracteres."),
});

export type VoidMoneyTransactionInput = z.input<typeof voidMoneyTransactionSchema>;

export async function voidMoneyTransaction(
  input: VoidMoneyTransactionInput
): Promise<{ id: string; voidedAt: Date }> {
  const { centerId, userId } = await requireCatalogContext();
  const parsed = voidMoneyTransactionSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Datos de anulación inválidos.");
  }
  const { transactionId, reason } = parsed.data;

  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{ id: string; voidedAt: Date | null }>
    >`
      SELECT id, "voidedAt"
      FROM "MoneyTransaction"
      WHERE "centerId" = ${centerId}::uuid AND id = ${transactionId}::uuid
      FOR UPDATE
    `;

    const existing = rows[0];
    if (!existing) {
      throw new DomainError("El movimiento de dinero no existe o no pertenece a este taller.");
    }

    if (existing.voidedAt !== null) {
      throw new DomainError("Este movimiento ya fue anulado.");
    }

    const now = new Date();
    await tx.moneyTransaction.updateMany({
      where: { centerId, id: transactionId },
      data: {
        voidedAt: now,
        voidedByUserId: userId,
        voidReason: reason,
      },
    });

    return { id: transactionId, voidedAt: now };
  });
}

export const returnOrderSchema = z.object({
  orderId: z.string({ error: "Identificador de pedido inválido." }).uuid("Identificador de pedido inválido."),
  expectedVersion: z.coerce
    .number({ error: "La versión del pedido es inválida." })
    .int("La versión del pedido debe ser un entero.")
    .min(1, "La versión del pedido debe ser al menos 1."),
  operationId: z.string({ error: "Identificador de operación inválido." }).uuid("Identificador de operación inválido."),
  refundAmount: z.coerce
    .number({ error: "El monto devuelto debe ser mayor a 0." })
    .int("El monto devuelto debe ser un número entero.")
    .min(1, "El monto devuelto debe ser mayor a 0."),
  method: z.enum(PAYMENT_METHODS, { error: "El método de reembolso no es válido." }),
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD.")
    .optional(),
  notes: z.string().trim().max(1000, "Las notas no pueden superar 1000 caracteres.").nullable().optional().default(null),
});

export type ReturnOrderInput = z.input<typeof returnOrderSchema>;

export async function returnOrder(
  input: ReturnOrderInput
): Promise<{ orderId: string; status: OrderStatus; version: number; transactionId: string }> {
  const { centerId, userId, timeZone } = await requireCatalogContext();
  const parsed = returnOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Datos de devolución inválidos.");
  }

  const data = parsed.data;
  const tz = timeZone ?? "America/Santiago";
  const dateStr = data.occurredOn ?? todayInTimeZone(new Date(), tz);

  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        version: number;
        deliveredAt: Date | null;
      }>
    >`
      SELECT id, status, version, "deliveredAt"
      FROM "Order"
      WHERE "centerId" = ${centerId}::uuid AND id = ${data.orderId}::uuid
      FOR UPDATE
    `;

    const order = rows[0];
    if (!order) {
      throw new DomainError("El pedido no existe o no pertenece a este taller.");
    }

    if (order.version !== data.expectedVersion) {
      throw new DomainError(
        "El pedido fue modificado por otra persona o pestaña. Recarga la página para ver el estado actual."
      );
    }

    const currentStatus = order.status as OrderStatus;
    if (currentStatus !== "DELIVERED" || !canTransition(currentStatus, "RETURNED")) {
      throw new DomainError(
        `Solo se puede registrar una devolución sobre un pedido entregado (estado actual: "${STATUS_LABEL[currentStatus]}").`
      );
    }

    const nextVersion = order.version + 1;

    await tx.order.update({
      where: { centerId_id: { centerId, id: data.orderId } },
      data: {
        status: "RETURNED",
        version: nextVersion,
        deliveredAt: order.deliveredAt ?? new Date(),
      },
    });

    await tx.orderEvent.create({
      data: {
        centerId,
        orderId: data.orderId,
        version: nextVersion,
        fromStatus: "DELIVERED",
        toStatus: "RETURNED",
        actorUserId: userId,
      },
    });

    const refundTx = await tx.moneyTransaction.create({
      data: {
        centerId,
        operationId: data.operationId,
        type: "EXPENSE",
        category: "REFUNDS",
        amount: data.refundAmount,
        occurredOn: new Date(`${dateStr}T00:00:00.000Z`),
        method: data.method,
        orderId: data.orderId,
        notes: data.notes,
        recordedByUserId: userId,
      },
    });

    return {
      orderId: data.orderId,
      status: "RETURNED",
      version: nextVersion,
      transactionId: refundTx.id,
    };
  });
}



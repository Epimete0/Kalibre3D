import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireOperationalContext } from "@/lib/auth";
import { todayInTimeZone } from "@/lib/money-summary";
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

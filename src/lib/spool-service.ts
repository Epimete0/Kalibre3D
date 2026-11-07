import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext, requireOperationalContext } from "@/lib/auth";
import { MATERIALS } from "@/lib/catalog-presentation";
import { PAYMENT_METHODS } from "@/lib/money-presentation";
import { todayInTimeZone } from "@/lib/money-summary";
import { persistedEntityId } from "@/lib/persisted-entity-id";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/unique-violation";

export const createSpoolSchema = z.object({
  operationId: z.string({ error: "Identificador de operación inválido." }).uuid("Identificador de operación inválido."),
  material: z.enum(MATERIALS, { error: "Selecciona un material válido." }),
  color: z
    .string({ error: "Escribe el color de la bobina." })
    .trim()
    .min(1, "Escribe el color de la bobina.")
    .max(80, "El color no puede superar 80 caracteres."),
  brand: z
    .string()
    .trim()
    .max(80, "La marca no puede superar 80 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  totalGrams: z.coerce
    .number({ error: "El peso total debe ser un número entero mayor a 0." })
    .int("El peso total debe ser un número entero.")
    .min(1, "El peso total debe ser mayor a 0.")
    .max(50000, "El peso total no puede superar 50.000 g.")
    .default(1000),
  remainingGrams: z.coerce
    .number({ error: "Los gramos restantes deben ser un entero mayor o igual a 0." })
    .int("Los gramos restantes deben ser un número entero.")
    .min(0, "Los gramos restantes no pueden ser negativos.")
    .max(50000, "Los gramos restantes no pueden superar 50.000 g.")
    .optional(),
  pricePaid: z.coerce
    .number({ error: "El precio pagado debe ser mayor o igual a 0." })
    .int("El precio pagado debe ser un número entero.")
    .min(0, "El precio pagado debe ser mayor o igual a 0."),
  purchasedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de compra debe tener formato AAAA-MM-DD.")
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Las notas no pueden superar 500 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  recordExpenseInMoney: z.boolean().optional().default(false),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().default("TRANSFER"),
});

export type CreateSpoolInput = z.input<typeof createSpoolSchema>;

export async function createSpool(
  input: CreateSpoolInput
): Promise<{ id: string; material: string; color: string; remainingGrams: number }> {
  const { centerId, userId, timeZone } = await requireCatalogContext();
  const parsed = createSpoolSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos de la bobina.");
  }

  const data = parsed.data;
  const remainingGrams = data.remainingGrams ?? data.totalGrams;
  const tz = timeZone ?? "America/Santiago";
  const purchasedDateStr = data.purchasedOn ?? todayInTimeZone(new Date(), tz);

  // Idempotencia: si ya existe el movimiento inicial con ese operationId, devolver la bobina creada
  const existingMovement = await prisma.spoolMovement.findUnique({
    where: {
      centerId_operationId: {
        centerId,
        operationId: data.operationId,
      },
    },
    include: {
      spool: {
        select: { id: true, material: true, color: true, remainingGrams: true },
      },
    },
  });
  if (existingMovement) {
    return existingMovement.spool;
  }

  return await prisma.$transaction(async (tx) => {
    const spool = await tx.spool.create({
      data: {
        centerId,
        material: data.material,
        color: data.color,
        brand: data.brand ?? null,
        totalGrams: data.totalGrams,
        remainingGrams,
        pricePaid: data.pricePaid,
        purchasedOn: new Date(`${purchasedDateStr}T00:00:00.000Z`),
        notes: data.notes ?? null,
        createdByUserId: userId,
      },
    });

    if (remainingGrams > 0) {
      await tx.spoolMovement.create({
        data: {
          centerId,
          operationId: data.operationId,
          spoolId: spool.id,
          kind: "INITIAL",
          deltaGrams: remainingGrams,
          resultingGrams: remainingGrams,
          actorUserId: userId,
          notes: "Alta de bobina",
        },
      });
    }

    if (data.recordExpenseInMoney && data.pricePaid > 0) {
      await tx.moneyTransaction.create({
        data: {
          centerId,
          operationId: randomUUID(),
          type: "EXPENSE",
          category: "FILAMENT",
          amount: data.pricePaid,
          occurredOn: new Date(`${purchasedDateStr}T00:00:00.000Z`),
          method: data.paymentMethod,
          notes: `Bobina ${data.material} ${data.color}${data.brand ? ` (${data.brand})` : ""}`,
          recordedByUserId: userId,
        },
      });
    }

    return {
      id: spool.id,
      material: spool.material,
      color: spool.color,
      remainingGrams: spool.remainingGrams,
    };
  });
}

export const updateSpoolSchema = z.object({
  id: persistedEntityId,
  material: z.enum(MATERIALS, { error: "Selecciona un material válido." }),
  color: z
    .string({ error: "Escribe el color de la bobina." })
    .trim()
    .min(1, "Escribe el color de la bobina.")
    .max(80, "El color no puede superar 80 caracteres."),
  brand: z
    .string()
    .trim()
    .max(80, "La marca no puede superar 80 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  totalGrams: z.coerce
    .number({ error: "El peso total debe ser un número entero mayor a 0." })
    .int("El peso total debe ser un número entero.")
    .min(1, "El peso total debe ser mayor a 0.")
    .max(50000, "El peso total no puede superar 50.000 g."),
  pricePaid: z.coerce
    .number({ error: "El precio pagado debe ser mayor o igual a 0." })
    .int("El precio pagado debe ser un número entero.")
    .min(0, "El precio pagado debe ser mayor o igual a 0."),
  purchasedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de compra debe tener formato AAAA-MM-DD."),
  notes: z
    .string()
    .trim()
    .max(500, "Las notas no pueden superar 500 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type UpdateSpoolInput = z.input<typeof updateSpoolSchema>;

export async function updateSpool(input: UpdateSpoolInput): Promise<{ id: string }> {
  const { centerId } = await requireCatalogContext();
  const parsed = updateSpoolSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos de la bobina.");
  }

  const data = parsed.data;
  const result = await prisma.spool.updateMany({
    where: { id: data.id, centerId },
    data: {
      material: data.material,
      color: data.color,
      brand: data.brand ?? null,
      totalGrams: data.totalGrams,
      pricePaid: data.pricePaid,
      purchasedOn: new Date(`${data.purchasedOn}T00:00:00.000Z`),
      notes: data.notes ?? null,
    },
  });

  if (result.count !== 1) {
    throw new DomainError("La bobina no existe o no pertenece a este taller.");
  }

  return { id: data.id };
}

export async function setSpoolActive(input: { id: string; active: boolean }): Promise<{ id: string; active: boolean }> {
  const { centerId } = await requireCatalogContext();
  const idParsed = persistedEntityId.safeParse(input.id);
  if (!idParsed.success) {
    throw new DomainError("Identificador de bobina inválido.");
  }

  const result = await prisma.spool.updateMany({
    where: { id: idParsed.data, centerId },
    data: { active: Boolean(input.active) },
  });

  if (result.count !== 1) {
    throw new DomainError("La bobina no existe o no pertenece a este taller.");
  }

  return { id: idParsed.data, active: Boolean(input.active) };
}

export const recordSpoolMovementSchema = z.object({
  operationId: z.string({ error: "Identificador de operación inválido." }).uuid("Identificador de operación inválido."),
  spoolId: persistedEntityId,
  kind: z.enum(["CONSUME", "ADJUST"], {
    error: "El tipo de movimiento de bobina no es válido.",
  }),
  deltaGrams: z.coerce
    .number({ error: "Indica la cantidad de gramos." })
    .int("Los gramos deben ser un número entero.")
    .refine((n) => n !== 0, "La variación de gramos no puede ser 0."),
  orderId: z.string().uuid().nullable().optional().default(null),
  notes: z
    .string()
    .trim()
    .max(500, "Las notas no pueden superar 500 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type RecordSpoolMovementInput = z.input<typeof recordSpoolMovementSchema>;

export async function recordSpoolMovement(
  input: RecordSpoolMovementInput
): Promise<{ id: string; spoolId: string; deltaGrams: number; resultingGrams: number }> {
  const { centerId, userId } = await requireOperationalContext();
  const parsed = recordSpoolMovementSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos del movimiento de filamento.");
  }

  const data = parsed.data;
  const deltaGrams = data.kind === "CONSUME" ? -Math.abs(data.deltaGrams) : data.deltaGrams;

  // Idempotencia previa
  const existing = await prisma.spoolMovement.findUnique({
    where: { centerId_operationId: { centerId, operationId: data.operationId } },
    select: { id: true, spoolId: true, deltaGrams: true, resultingGrams: true },
  });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; remainingGrams: number }>>`
        SELECT id, "remainingGrams"
        FROM "Spool"
        WHERE "centerId" = ${centerId}::uuid AND id = ${data.spoolId}::uuid
        FOR UPDATE
      `;

      const spool = rows[0];
      if (!spool) {
        throw new DomainError("La bobina no existe o no pertenece a este taller.");
      }

      const inTxExisting = await tx.spoolMovement.findUnique({
        where: { centerId_operationId: { centerId, operationId: data.operationId } },
        select: { id: true, spoolId: true, deltaGrams: true, resultingGrams: true },
      });
      if (inTxExisting) {
        return inTxExisting;
      }

      const resultingGrams = spool.remainingGrams + deltaGrams;
      if (resultingGrams < 0) {
        throw new DomainError(
          `No hay suficiente filamento en la bobina (disponible: ${spool.remainingGrams} g).`
        );
      }

      await tx.spool.updateMany({
        where: { id: data.spoolId, centerId },
        data: { remainingGrams: resultingGrams },
      });

      const movement = await tx.spoolMovement.create({
        data: {
          centerId,
          operationId: data.operationId,
          spoolId: data.spoolId,
          kind: data.kind,
          deltaGrams,
          resultingGrams,
          orderId: data.orderId,
          notes: data.notes ?? null,
          actorUserId: userId,
        },
        select: { id: true, spoolId: true, deltaGrams: true, resultingGrams: true },
      });

      return movement;
    });
  } catch (error) {
    if (isUniqueViolation(error, "SpoolMovement_centerId_operationId_key")) {
      const winner = await prisma.spoolMovement.findUnique({
        where: { centerId_operationId: { centerId, operationId: data.operationId } },
        select: { id: true, spoolId: true, deltaGrams: true, resultingGrams: true },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

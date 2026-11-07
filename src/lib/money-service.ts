import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext } from "@/lib/auth";
import {
  MANUAL_EXPENSE_CATEGORIES,
  MANUAL_INCOME_CATEGORIES,
  PAYMENT_METHODS,
  type ManualExpenseCategory,
  type ManualIncomeCategory,
} from "@/lib/money-presentation";
import { todayInTimeZone } from "@/lib/money-summary";
import { voidMoneyTransaction as voidOrderMoneyTransaction, type VoidMoneyTransactionInput } from "@/lib/order-service";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/unique-violation";

export const recordManualMoneySchema = z
  .object({
    operationId: z
      .string({ error: "Identificador de operación inválido." })
      .uuid("Identificador de operación inválido."),
    type: z.enum(["INCOME", "EXPENSE"], {
      error: "El tipo de movimiento no es válido.",
    }),
    category: z.string({ error: "La categoría es obligatoria." }).trim().min(1, "La categoría es obligatoria."),
    amount: z.coerce
      .number({ error: "El monto debe ser un número entero mayor a 0." })
      .int("El monto debe ser un número entero.")
      .min(1, "El monto debe ser mayor a 0.")
      .max(1_000_000_000, "El monto supera el máximo permitido."),
    method: z.enum(PAYMENT_METHODS, {
      error: "El método de pago no es válido.",
    }),
    occurredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato AAAA-MM-DD.")
      .optional(),
    notes: z
      .string()
      .trim()
      .max(1000, "Las notas no pueden superar 1000 caracteres.")
      .nullable()
      .optional()
      .default(null),
  })
  .superRefine((val, ctx) => {
    if (val.type === "INCOME") {
      if (!(MANUAL_INCOME_CATEGORIES as readonly string[]).includes(val.category)) {
        ctx.addIssue({
          code: "custom",
          path: ["category"],
          message: "La categoría de ingreso manual no es válida.",
        });
      }
    } else if (val.type === "EXPENSE") {
      if (!(MANUAL_EXPENSE_CATEGORIES as readonly string[]).includes(val.category)) {
        ctx.addIssue({
          code: "custom",
          path: ["category"],
          message: "La categoría de gasto no es válida.",
        });
      }
    }
  });

export type RecordManualMoneyInput = z.input<typeof recordManualMoneySchema> & {
  now?: Date;
};

export type ManualMoneyCategory = ManualIncomeCategory | ManualExpenseCategory;

export async function recordManualMoneyTransaction(
  input: RecordManualMoneyInput
): Promise<{ id: string; type: "INCOME" | "EXPENSE"; category: string; amount: number; occurredOn: string }> {
  const { centerId, userId, timeZone } = await requireCatalogContext();
  const parsed = recordManualMoneySchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      parsed.error.issues[0]?.message ?? "Datos del movimiento de dinero inválidos."
    );
  }

  const data = parsed.data;
  const tz = timeZone ?? "America/Santiago";
  const nowDate = input.now instanceof Date ? input.now : new Date();
  const dateStr = data.occurredOn ?? todayInTimeZone(nowDate, tz);

  const existing = await prisma.moneyTransaction.findUnique({
    where: {
      centerId_operationId: {
        centerId,
        operationId: data.operationId,
      },
    },
    select: {
      id: true,
      type: true,
      category: true,
      amount: true,
      occurredOn: true,
    },
  });

  if (existing) {
    return {
      id: existing.id,
      type: existing.type as "INCOME" | "EXPENSE",
      category: existing.category,
      amount: existing.amount,
      occurredOn: existing.occurredOn.toISOString().slice(0, 10),
    };
  }

  try {
    const created = await prisma.moneyTransaction.create({
      data: {
        centerId,
        operationId: data.operationId,
        type: data.type,
        category: data.category,
        amount: data.amount,
        occurredOn: new Date(`${dateStr}T00:00:00.000Z`),
        method: data.method,
        orderId: null,
        notes: data.notes,
        recordedByUserId: userId,
      },
    });

    return {
      id: created.id,
      type: created.type as "INCOME" | "EXPENSE",
      category: created.category,
      amount: created.amount,
      occurredOn: created.occurredOn.toISOString().slice(0, 10),
    };
  } catch (error) {
    if (isUniqueViolation(error, "MoneyTransaction_centerId_operationId_key")) {
      const winner = await prisma.moneyTransaction.findUnique({
        where: {
          centerId_operationId: {
            centerId,
            operationId: data.operationId,
          },
        },
        select: {
          id: true,
          type: true,
          category: true,
          amount: true,
          occurredOn: true,
        },
      });
      if (winner) {
        return {
          id: winner.id,
          type: winner.type as "INCOME" | "EXPENSE",
          category: winner.category,
          amount: winner.amount,
          occurredOn: winner.occurredOn.toISOString().slice(0, 10),
        };
      }
    }
    throw error;
  }
}

export async function voidManualMoneyTransaction(
  input: VoidMoneyTransactionInput
): Promise<{ id: string; voidedAt: Date }> {
  await requireCatalogContext();
  return voidOrderMoneyTransaction(input);
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext, requireOperationalContext } from "@/lib/auth";
import { MATERIALS } from "@/lib/catalog-presentation";
import { persistedEntityId } from "@/lib/persisted-entity-id";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation, uniqueViolationMessage } from "@/lib/unique-violation";

export const PRODUCT_NAME_MAX = 160;

const productNameSchema = z
  .string({ error: "Escribe el nombre de la pieza." })
  .trim()
  .min(1, "Escribe el nombre de la pieza.")
  .max(PRODUCT_NAME_MAX, `El nombre es demasiado largo (máximo ${PRODUCT_NAME_MAX} caracteres).`);

const priceSchema = z.coerce
  .number({ error: "El precio debe ser un número entero mayor o igual a 0." })
  .int("El precio debe ser un número entero.")
  .min(0, "El precio debe ser un número entero mayor o igual a 0.");

const optionalMlPriceSchema = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? null : val),
  priceSchema.nullable()
);

const optionalCategorySchema = z.preprocess(
  (val) => {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(80, "La categoría no puede superar 80 caracteres.").nullable()
);

const nonNegativeIntSchema = (label: string) =>
  z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? 0 : val),
    z.coerce
      .number({ error: `${label} debe ser un número entero mayor o igual a 0.` })
      .int(`${label} debe ser un número entero.`)
      .min(0, `${label} debe ser mayor o igual a 0.`)
  );

const colorsCountSchema = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? 1 : val),
  z.coerce
    .number({ error: "La cantidad de colores debe estar entre 1 y 16." })
    .int("La cantidad de colores debe ser un número entero.")
    .min(1, "La cantidad de colores debe ser al menos 1.")
    .max(16, "La cantidad de colores no puede superar 16.")
);

const materialSchema = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? "PETG" : val),
  z.enum(MATERIALS, { error: "Selecciona un material válido." })
);

const createProductSchema = z.object({
  name: productNameSchema,
  salePrice: priceSchema,
  mlPrice: optionalMlPriceSchema,
  category: optionalCategorySchema,
  material: materialSchema,
  grams: nonNegativeIntSchema("Los gramos"),
  printMinutes: nonNegativeIntSchema("Los minutos de impresión"),
  colorsCount: colorsCountSchema,
  purgeGrams: nonNegativeIntSchema("Los gramos de purga"),
  initialStock: nonNegativeIntSchema("El stock inicial"),
  minStock: nonNegativeIntSchema("El stock mínimo"),
});

const updateProductSchema = z.object({
  id: persistedEntityId,
  name: productNameSchema,
  salePrice: priceSchema,
  mlPrice: optionalMlPriceSchema,
  category: optionalCategorySchema,
  material: materialSchema,
  grams: nonNegativeIntSchema("Los gramos"),
  printMinutes: nonNegativeIntSchema("Los minutos de impresión"),
  colorsCount: colorsCountSchema,
  purgeGrams: nonNegativeIntSchema("Los gramos de purga"),
  minStock: nonNegativeIntSchema("El stock mínimo"),
});

/** Crea una nueva pieza en el catálogo del taller. Solo OWNER y ADMIN. */
export async function createProduct(formData: FormData) {
  const { centerId, userId } = await requireCatalogContext();

  const raw = {
    name: formData.get("name"),
    salePrice: formData.get("salePrice"),
    mlPrice: formData.get("mlPrice"),
    category: formData.get("category"),
    material: formData.get("material"),
    grams: formData.get("grams"),
    printMinutes: formData.get("printMinutes"),
    colorsCount: formData.get("colorsCount"),
    purgeGrams: formData.get("purgeGrams"),
    initialStock: formData.get("initialStock"),
    minStock: formData.get("minStock"),
  };

  const parsed = createProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos de la pieza.");
  }

  const normalized = parsed.data.name.trim();

  // Validación previa rápida
  const existing = await prisma.product.findFirst({
    where: {
      centerId,
      name: { equals: normalized, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) {
    throw new DomainError("Ya existe una pieza con ese nombre.");
  }

  try {
    const product = await prisma.product.create({
      data: {
        centerId,
        name: normalized,
        salePrice: parsed.data.salePrice,
        mlPrice: parsed.data.mlPrice,
        category: parsed.data.category,
        material: parsed.data.material,
        grams: parsed.data.grams,
        printMinutes: parsed.data.printMinutes,
        colorsCount: parsed.data.colorsCount,
        purgeGrams: parsed.data.purgeGrams,
        currentStock: parsed.data.initialStock,
        minStock: parsed.data.minStock,
        createdByUserId: userId,
      },
    });

    if (parsed.data.initialStock > 0) {
      await prisma.productMovement.create({
        data: {
          centerId,
          operationId: randomUUID(),
          productId: product.id,
          kind: "INITIAL",
          delta: parsed.data.initialStock,
          resultingStock: parsed.data.initialStock,
          notes: "Stock inicial al crear pieza",
          actorUserId: userId,
        },
      });
    }

    return product;
  } catch (error) {
    const violation = uniqueViolationMessage(error);
    if (violation) throw new DomainError(violation);
    throw error;
  }
}

/** Modifica los datos de una pieza existente (nunca modifica currentStock directo). Solo OWNER y ADMIN. */
export async function updateProduct(formData: FormData) {
  const { centerId } = await requireCatalogContext();

  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    salePrice: formData.get("salePrice"),
    mlPrice: formData.get("mlPrice"),
    category: formData.get("category"),
    material: formData.get("material"),
    grams: formData.get("grams"),
    printMinutes: formData.get("printMinutes"),
    colorsCount: formData.get("colorsCount"),
    purgeGrams: formData.get("purgeGrams"),
    minStock: formData.get("minStock"),
  };

  const parsed = updateProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos de la pieza.");
  }

  const normalized = parsed.data.name.trim();

  // Comprobar si otra pieza del mismo taller ya usa ese nombre
  const existing = await prisma.product.findFirst({
    where: {
      centerId,
      id: { not: parsed.data.id },
      name: { equals: normalized, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing) {
    throw new DomainError("Ya existe una pieza con ese nombre.");
  }

  try {
    const result = await prisma.product.updateMany({
      where: { id: parsed.data.id, centerId },
      data: {
        name: normalized,
        salePrice: parsed.data.salePrice,
        mlPrice: parsed.data.mlPrice,
        category: parsed.data.category,
        material: parsed.data.material,
        grams: parsed.data.grams,
        printMinutes: parsed.data.printMinutes,
        colorsCount: parsed.data.colorsCount,
        purgeGrams: parsed.data.purgeGrams,
        minStock: parsed.data.minStock,
      },
    });

    if (result.count !== 1) {
      throw new DomainError("No fue posible actualizar la pieza. Intenta nuevamente.");
    }

    return { id: parsed.data.id, name: normalized };
  } catch (error) {
    const violation = uniqueViolationMessage(error);
    if (violation) throw new DomainError(violation);
    throw error;
  }
}

/** Activa o desactiva una pieza (baja lógica para ocultarla de nuevas ventas sin romper pedidos históricos). */
export async function setProductActive(formData: FormData) {
  const { centerId } = await requireCatalogContext();

  const id = String(formData.get("id") ?? "");
  const idParsed = persistedEntityId.safeParse(id);
  if (!idParsed.success) throw new DomainError("Identificador inválido.");

  const activeRaw = formData.get("active");
  const active = activeRaw === "true" || activeRaw === "1";

  const result = await prisma.product.updateMany({
    where: { id: idParsed.data, centerId },
    data: { active },
  });

  if (result.count !== 1) {
    throw new DomainError("No fue posible cambiar el estado de la pieza. Intenta nuevamente.");
  }

  return { id: idParsed.data, active };
}

/**
 * Elimina físicamente una pieza.
 * Regla de oro de ciclo de vida (AGENTS.md y D16):
 * Solo se permite la eliminación física si la pieza NUNCA ha sido utilizada en ningún pedido
 * ni tiene movimientos reales de stock (el movimiento INITIAL no cuenta como uso real).
 */
export async function deleteProduct(formData: FormData) {
  const { centerId } = await requireCatalogContext();

  const id = String(formData.get("id") ?? "");
  const idParsed = persistedEntityId.safeParse(id);
  if (!idParsed.success) throw new DomainError("Identificador inválido.");

  const [ordersCount, realMovementsCount] = await Promise.all([
    prisma.orderItem.count({
      where: { centerId, productId: idParsed.data },
    }),
    prisma.productMovement.count({
      where: {
        centerId,
        productId: idParsed.data,
        kind: { not: "INITIAL" },
      },
    }),
  ]);

  if (ordersCount > 0 || realMovementsCount > 0) {
    throw new DomainError(
      "No se puede eliminar la pieza porque ya tiene pedidos registrados. Puedes desactivarla para ocultarla."
    );
  }

  const result = await prisma.product.deleteMany({
    where: { id: idParsed.data, centerId },
  });

  if (result.count !== 1) {
    throw new DomainError("No fue posible eliminar la pieza. Intenta nuevamente.");
  }

  return { id: idParsed.data, deleted: true };
}

export const recordProductMovementSchema = z.object({
  operationId: z.string({ error: "Identificador de operación inválido." }).uuid("Identificador de operación inválido."),
  productId: persistedEntityId,
  kind: z.enum(["ENTRY", "EXIT", "ADJUST"], {
    error: "El tipo de movimiento de stock no es válido.",
  }),
  delta: z.coerce
    .number({ error: "Indica la cantidad de unidades." })
    .int("La cantidad debe ser un número entero.")
    .refine((n) => n !== 0, "La variación de stock no puede ser 0."),
  orderId: z.string().uuid().nullable().optional().default(null),
  notes: z
    .string()
    .trim()
    .max(500, "Las notas no pueden superar 500 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type RecordProductMovementInput = z.input<typeof recordProductMovementSchema>;

/** Registra un movimiento inmutable de stock de una pieza (D15). */
export async function recordProductMovement(
  input: RecordProductMovementInput
): Promise<{ id: string; productId: string; delta: number; resultingStock: number }> {
  const { centerId, userId } = await requireOperationalContext();
  const parsed = recordProductMovementSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(parsed.error.issues[0]?.message ?? "Revisa los datos del movimiento de stock.");
  }

  const data = parsed.data;
  const delta =
    data.kind === "ENTRY"
      ? Math.abs(data.delta)
      : data.kind === "EXIT"
        ? -Math.abs(data.delta)
        : data.delta;

  const existing = await prisma.productMovement.findUnique({
    where: { centerId_operationId: { centerId, operationId: data.operationId } },
    select: { id: true, productId: true, delta: true, resultingStock: true },
  });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; currentStock: number }>>`
        SELECT id, "currentStock"
        FROM "Product"
        WHERE "centerId" = ${centerId}::uuid AND id = ${data.productId}::uuid
        FOR UPDATE
      `;

      const product = rows[0];
      if (!product) {
        throw new DomainError("La pieza no existe o no pertenece a este taller.");
      }

      const inTxExisting = await tx.productMovement.findUnique({
        where: { centerId_operationId: { centerId, operationId: data.operationId } },
        select: { id: true, productId: true, delta: true, resultingStock: true },
      });
      if (inTxExisting) {
        return inTxExisting;
      }

      const resultingStock = product.currentStock + delta;
      if (resultingStock < 0) {
        throw new DomainError(
          `No hay suficiente stock de la pieza (disponible: ${product.currentStock}).`
        );
      }

      await tx.product.updateMany({
        where: { id: data.productId, centerId },
        data: { currentStock: resultingStock },
      });

      const movement = await tx.productMovement.create({
        data: {
          centerId,
          operationId: data.operationId,
          productId: data.productId,
          kind: data.kind,
          delta,
          resultingStock,
          orderId: data.orderId,
          notes: data.notes ?? null,
          actorUserId: userId,
        },
        select: { id: true, productId: true, delta: true, resultingStock: true },
      });

      return movement;
    });
  } catch (error) {
    if (isUniqueViolation(error, "ProductMovement_centerId_operationId_key")) {
      const winner = await prisma.productMovement.findUnique({
        where: { centerId_operationId: { centerId, operationId: data.operationId } },
        select: { id: true, productId: true, delta: true, resultingStock: true },
      });
      if (winner) return winner;
    }
    throw error;
  }
}

import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext } from "@/lib/auth";
import { persistedEntityId } from "@/lib/persisted-entity-id";
import { prisma } from "@/lib/prisma";
import { uniqueViolationMessage } from "@/lib/unique-violation";

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

const createProductSchema = z.object({
  name: productNameSchema,
  salePrice: priceSchema,
  mlPrice: optionalMlPriceSchema,
});

const updateProductSchema = createProductSchema.extend({
  id: persistedEntityId,
});

/** Crea una nueva pieza en la lista de precios del taller. Solo OWNER y ADMIN. */
export async function createProduct(formData: FormData) {
  const { centerId, userId } = await requireCatalogContext();

  const raw = {
    name: formData.get("name"),
    salePrice: formData.get("salePrice"),
    mlPrice: formData.get("mlPrice"),
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
    return await prisma.product.create({
      data: {
        centerId,
        name: normalized,
        salePrice: parsed.data.salePrice,
        mlPrice: parsed.data.mlPrice,
        createdByUserId: userId,
      },
    });
  } catch (error) {
    const violation = uniqueViolationMessage(error);
    if (violation) throw new DomainError(violation);
    throw error;
  }
}

/** Modifica los datos de una pieza existente. Solo OWNER y ADMIN. */
export async function updateProduct(formData: FormData) {
  const { centerId } = await requireCatalogContext();

  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    salePrice: formData.get("salePrice"),
    mlPrice: formData.get("mlPrice"),
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
 * Regla de oro de ciclo de vida (AGENTS.md):
 * Solo se permite la eliminación física si la pieza NUNCA ha sido utilizada en ningún pedido.
 * Si ya tiene pedidos vinculados, debe desactivarse para preservar la trazabilidad histórica.
 */
export async function deleteProduct(formData: FormData) {
  const { centerId } = await requireCatalogContext();

  const id = String(formData.get("id") ?? "");
  const idParsed = persistedEntityId.safeParse(id);
  if (!idParsed.success) throw new DomainError("Identificador inválido.");

  const ordersCount = await prisma.orderItem.count({
    where: { centerId, productId: idParsed.data },
  });

  if (ordersCount > 0) {
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

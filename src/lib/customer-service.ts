import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext, requireOperationalContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const cleanInstagramHandle = (val: string | null | undefined): string | null => {
  if (!val) return null;
  const cleaned = val.trim().replace(/^@+/, "").trim();
  return cleaned.length > 0 ? cleaned : null;
};

const cleanOptionalString = (val: string | null | undefined, max: number, maxMessage: string): string | null => {
  if (!val) return null;
  const trimmed = val.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw new DomainError(maxMessage);
  return trimmed;
};

export const createCustomerSchema = z.object({
  name: z
    .string({ error: "El nombre del cliente es obligatorio." })
    .trim()
    .min(1, "El nombre del cliente es obligatorio.")
    .max(100, "El nombre no puede superar los 100 caracteres."),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform((val) => cleanOptionalString(val, 40, "El teléfono no puede superar los 40 caracteres.")),
  instagram: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      const cleaned = cleanInstagramHandle(val);
      if (cleaned && cleaned.length > 50) {
        throw new DomainError("El usuario de Instagram no puede superar los 50 caracteres.");
      }
      return cleaned;
    }),
  notes: z
    .string()
    .optional()
    .nullable()
    .transform((val) => cleanOptionalString(val, 2000, "Las notas no pueden superar los 2000 caracteres.")),
});

export const updateCustomerSchema = createCustomerSchema.extend({
  id: z.string().uuid("Identificador de cliente no válido."),
});

function parseInputData(input: unknown): Record<string, unknown> {
  if (input instanceof FormData) {
    return {
      id: input.get("id"),
      name: input.get("name"),
      phone: input.get("phone"),
      instagram: input.get("instagram"),
      notes: input.get("notes"),
    };
  }
  if (input && typeof input === "object") {
    return input as Record<string, unknown>;
  }
  return {};
}

function handleZodError(error: unknown): never {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues[0];
    throw new DomainError(firstIssue.message);
  }
  throw error;
}

export async function createCustomer(input: unknown) {
  const context = await requireOperationalContext();
  const rawData = parseInputData(input);

  let data: z.infer<typeof createCustomerSchema>;
  try {
    data = createCustomerSchema.parse(rawData);
  } catch (error) {
    handleZodError(error);
  }

  const customer = await prisma.customer.create({
    data: {
      centerId: context.centerId,
      createdByUserId: context.userId,
      name: data.name,
      phone: data.phone,
      instagram: data.instagram,
      notes: data.notes,
      active: true,
    },
  });

  return customer;
}

export async function updateCustomer(input: unknown) {
  const context = await requireOperationalContext();
  const rawData = parseInputData(input);

  let data: z.infer<typeof updateCustomerSchema>;
  try {
    data = updateCustomerSchema.parse(rawData);
  } catch (error) {
    handleZodError(error);
  }

  const result = await prisma.customer.updateMany({
    where: {
      id: data.id,
      centerId: context.centerId,
    },
    data: {
      name: data.name,
      phone: data.phone,
      instagram: data.instagram,
      notes: data.notes,
    },
  });

  if (result.count === 0) {
    throw new DomainError("Cliente no encontrado.");
  }

  return { id: data.id };
}

export async function setCustomerActive(input: FormData | string, maybeActive?: boolean) {
  const context = await requireOperationalContext();
  const idRaw = input instanceof FormData ? input.get("id") : input;
  const activeRaw = input instanceof FormData ? input.get("active") : maybeActive;

  const validId = z.string().uuid("Identificador de cliente no válido.").parse(idRaw);
  const active = activeRaw === true || activeRaw === "true" || activeRaw === "1";

  const result = await prisma.customer.updateMany({
    where: {
      id: validId,
      centerId: context.centerId,
    },
    data: { active },
  });

  if (result.count === 0) {
    throw new DomainError("Cliente no encontrado.");
  }

  return { id: validId, active };
}

export async function deleteCustomer(input: FormData | string) {
  const context = await requireCatalogContext();
  const idRaw = input instanceof FormData ? input.get("id") : input;
  const validId = z.string().uuid("Identificador de cliente no válido.").parse(idRaw);

  const ordersCount = await prisma.order.count({
    where: {
      centerId: context.centerId,
      customerId: validId,
    },
  });

  if (ordersCount > 0) {
    throw new DomainError(
      "No se puede eliminar el cliente porque ya tiene pedidos registrados. Puedes desactivarlo para ocultarlo."
    );
  }

  const result = await prisma.customer.deleteMany({
    where: {
      id: validId,
      centerId: context.centerId,
    },
  });

  if (result.count === 0) {
    throw new DomainError("Cliente no encontrado.");
  }

  return { id: validId };
}

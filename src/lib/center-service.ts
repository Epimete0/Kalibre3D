import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "./action-errors";
import { requireCatalogContext } from "./auth";
import { validateIanaTimeZone } from "./center-time-zone";
import { prisma } from "./prisma";

const MAX_SERIALIZATION_RETRIES = 3;

function isSerializationConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

export async function createCenterForUser(
  userId: string,
  input: { name: string; timeZone: string },
  db: PrismaClient = prisma,
) {
  const timeZone = validateIanaTimeZone(input.timeZone);

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      return await db.$transaction(async (tx) => {
        const existingMembership = await tx.centerMember.findFirst({
          where: { userId, active: true, center: { active: true } },
          select: { centerId: true },
        });
        if (existingMembership) throw new DomainError("Ya perteneces a un taller activo.");

        await tx.profile.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
        const center = await tx.center.create({ data: { name: input.name, timeZone } });
        await tx.centerMember.create({ data: { centerId: center.id, userId, role: "OWNER" } });
        return center;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isSerializationConflict(error) && attempt < MAX_SERIALIZATION_RETRIES - 1) continue;
      if (isSerializationConflict(error)) throw new DomainError("No fue posible crear el taller porque hubo otra operación simultánea. Intenta nuevamente.");
      throw error;
    }
  }

  throw new DomainError("No fue posible crear el taller. Intenta nuevamente.");
}

export async function updateCenterTimeZone(formData: FormData) {
  const { centerId } = await requireCatalogContext();
  const submitted = formData.get("timeZone");
  if (typeof submitted !== "string") throw new DomainError("La zona horaria del taller no es válida.");

  let timeZone: string;
  try {
    timeZone = validateIanaTimeZone(submitted);
  } catch {
    throw new DomainError("La zona horaria del taller no es válida.");
  }

  const result = await prisma.center.updateMany({ where: { id: centerId }, data: { timeZone } });
  if (result.count !== 1) throw new DomainError("No fue posible actualizar la zona horaria del taller. Intenta nuevamente.");
  return { timeZone };
}

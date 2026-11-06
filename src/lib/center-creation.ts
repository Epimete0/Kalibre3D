import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/lib/action-errors";
import { requireSessionUser } from "@/lib/auth";
import { CENTER_LIMIT_MESSAGE, GENERIC_CENTER_ERROR, MAX_OWNED_CENTERS, parseCreateCenter, type CreateCenterInput } from "@/lib/center-creation-rules";
import { prisma } from "@/lib/prisma";

/**
 * Crear un taller propio (registro abierto del SaaS).
 *
 * - Solo se crea desde el servidor: RLS impide que una sesión cualquiera inserte `Center` o `CenterMember` por la API.
 * - El rol del creador es siempre OWNER (todos los permisos): en un taller de una sola persona, quien lo
 *   crea es quien atiende. El rol nunca viene del formulario.
 * - Cada persona puede tener **un** taller propio activo (OWNER). La regla vive en el servicio y se serializa por persona con un
 *   candado de la base de datos; no puede ser una restricción única porque ya hay personas con varios talleres y un taller puede
 *   tener varios OWNER.
 * - Sin duplicados al repetir el envío: el identificador del taller lo genera la página y se usa como clave primaria. Repetir el
 *   envío devuelve el mismo taller; usar el identificador de un taller ajeno se rechaza sin dar detalles.
 */

export * from "@/lib/center-creation-rules";

export type CenterCreationDeps = { prisma?: PrismaClient; userId?: string; afterLockAcquired?: () => Promise<void> };

/** Cuántos talleres propios activos (OWNER) tiene la persona. */
export async function countOwnedCenters(db: Pick<PrismaClient, "centerMember">, userId: string) {
  return db.centerMember.count({ where: { userId, role: "OWNER", active: true, center: { active: true } } });
}

export async function createCenterWithDb(db: PrismaClient, userId: string, input: CreateCenterInput, hooks: Pick<CenterCreationDeps, "afterLockAcquired"> = {}) {
  try {
    return await db.$transaction(async (tx) => {
      // Una creación por persona a la vez: el segundo envío espera al primero y ve su resultado.
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`saas3d:create-center:${userId}`}))`);
      await hooks.afterLockAcquired?.();

      const existing = await tx.center.findUnique({ where: { id: input.centerId }, select: { id: true } });
      if (existing) {
        const mine = await tx.centerMember.findFirst({ where: { centerId: input.centerId, userId, role: "OWNER", active: true }, select: { userId: true } });
        if (mine) return { centerId: input.centerId, created: false };
        throw new DomainError(GENERIC_CENTER_ERROR);
      }

      if ((await countOwnedCenters(tx, userId)) >= MAX_OWNED_CENTERS) throw new DomainError(CENTER_LIMIT_MESSAGE);

      await tx.profile.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
      await tx.center.create({ data: { id: input.centerId, name: input.name, timeZone: input.timeZone } });
      await tx.centerMember.create({ data: { centerId: input.centerId, userId, role: "OWNER" } });
      return { centerId: input.centerId, created: true };
    }, { timeout: 15_000 });
  } catch (error) {
    // Dos personas con el mismo identificador: la segunda choca con la clave primaria y no se le dice por qué.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DomainError(GENERIC_CENTER_ERROR);
    throw error;
  }
}

export async function createCenter(formData: FormData, deps: CenterCreationDeps = {}) {
  const userId = deps.userId ?? await requireSessionUser();
  const input = parseCreateCenter(formData);
  return createCenterWithDb(deps.prisma ?? prisma, userId, input, { afterLockAcquired: deps.afterLockAcquired });
}

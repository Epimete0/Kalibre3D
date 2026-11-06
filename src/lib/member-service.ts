import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/lib/action-errors";
import { requireAuthContext, requireCatalogContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateActiveChange, validateRoleChange, type TeamRole } from "@/lib/team-rules";

/**
 * Equipo del taller: ver a las personas, cambiarles el rol y desactivarlas o reactivarlas (baja lógica; nunca se borra a nadie).
 * Solo OWNER y ADMIN modifican, según `team-rules.ts`. Toda consulta lleva `centerId`.
 *
 * Cada cambio bloquea (FOR UPDATE, en orden de `userId`) a los dueños del taller y a la persona afectada: dos cambios a la
 * vez se ordenan y el taller no se queda sin dueño aunque dos se bajen de rol entre sí. La base de datos lo vuelve a
 * exigir con un trigger diferido (`CenterMember_last_owner_guard`).
 */

export type __TeamTestDeps = { prisma: PrismaClient; auth: { centerId: string; userId: string; role: TeamRole }; /** Solo pruebas: se ejecuta con las filas ya bloqueadas. */ afterLocked?: () => Promise<void> };

type Locked = { userId: string; role: TeamRole; active: boolean };

export async function listTeam(deps?: Pick<__TeamTestDeps, "prisma" | "auth">) {
  const auth = deps?.auth ?? await requireAuthContext();
  const db = deps?.prisma ?? prisma;
  const members = await db.centerMember.findMany({
    where: { centerId: auth.centerId },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: { userId: true, role: true, active: true, createdAt: true, profile: { select: { displayName: true } } },
  });
  return {
    me: { userId: auth.userId, role: auth.role as TeamRole },
    members: members.map((member) => ({ userId: member.userId, name: member.profile.displayName || "Integrante", role: member.role as TeamRole, active: member.active, since: member.createdAt })),
  };
}

async function lockTarget(tx: Prisma.TransactionClient, centerId: string, targetUserId: string) {
  const rows = await tx.$queryRaw<Locked[]>(Prisma.sql`
    SELECT "userId", "role", "active"
    FROM "CenterMember"
    WHERE "centerId" = ${centerId} AND ("role" = 'OWNER' OR "userId" = ${targetUserId}::uuid)
    ORDER BY "userId"
    FOR UPDATE
  `);
  const target = rows.find((row) => row.userId === targetUserId);
  if (!target) throw new DomainError("La persona no pertenece a este taller.");
  const remainingOwners = rows.filter((row) => row.role === "OWNER" && row.active && row.userId !== targetUserId).length;
  return { target, remainingOwners };
}

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function changeMemberRole(targetUserId: string, nextRole: string, deps?: __TeamTestDeps) {
  const auth = deps?.auth ?? await requireCatalogContext();
  const db = deps?.prisma ?? prisma;
  if (!isUuid(targetUserId)) throw new DomainError("La persona no pertenece a este taller.");
  return db.$transaction(async (tx) => {
    const { target, remainingOwners } = await lockTarget(tx, auth.centerId, targetUserId);
    await deps?.afterLocked?.();
    const problem = validateRoleChange({ userId: auth.userId, role: auth.role as TeamRole }, target, nextRole, remainingOwners);
    if (problem) throw new DomainError(problem);
    const result = await tx.centerMember.updateMany({ where: { centerId: auth.centerId, userId: targetUserId }, data: { role: nextRole } });
    if (result.count !== 1) throw new DomainError("La persona no pertenece a este taller.");
    return { userId: targetUserId, role: nextRole as TeamRole };
  });
}

/** Desactiva o reactiva a una persona del taller. */
export async function setMemberActive(targetUserId: string, active: boolean, deps?: __TeamTestDeps) {
  const auth = deps?.auth ?? await requireCatalogContext();
  const db = deps?.prisma ?? prisma;
  if (!isUuid(targetUserId)) throw new DomainError("La persona no pertenece a este taller.");
  return db.$transaction(async (tx) => {
    const { target, remainingOwners } = await lockTarget(tx, auth.centerId, targetUserId);
    await deps?.afterLocked?.();
    const problem = validateActiveChange({ userId: auth.userId, role: auth.role as TeamRole }, target, active, remainingOwners);
    if (problem) throw new DomainError(problem);
    const result = await tx.centerMember.updateMany({ where: { centerId: auth.centerId, userId: targetUserId }, data: { active } });
    if (result.count !== 1) throw new DomainError("La persona no pertenece a este taller.");
    return { userId: targetUserId, active };
  });
}

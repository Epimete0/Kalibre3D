import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "./action-errors";
import { retryTransactionConflicts } from "./transaction-conflict-retry";

export async function archiveCenterForOwnerWithDb({ db, centerId, userId }: { db: PrismaClient; centerId: string; userId: string }) {
  return retryTransactionConflicts(() => db.$transaction(async (tx) => {
    const [center] = await tx.$queryRaw<{ id: string; active: boolean }[]>(Prisma.sql`SELECT "id", "active" FROM "Center" WHERE "id" = ${centerId} FOR UPDATE`);
    if (!center?.active) throw new DomainError("El taller ya está archivado.");
    const [owner] = await tx.$queryRaw<{ centerId: string; userId: string; active: boolean; role: string }[]>(Prisma.sql`
      SELECT "centerId", "userId", "active", "role"
      FROM "CenterMember"
      WHERE "centerId" = ${centerId} AND "userId" = ${userId}
      FOR UPDATE
    `);
    if (!owner?.active || owner.role !== "OWNER") throw new DomainError("No tienes permiso para archivar este taller.");
    await tx.center.update({ where: { id: centerId }, data: { active: false } });
    await tx.centerMember.updateMany({ where: { centerId, active: true }, data: { active: false } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

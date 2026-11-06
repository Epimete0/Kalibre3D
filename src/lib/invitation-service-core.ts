import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "./action-errors";
import { retryTransactionConflicts } from "./transaction-conflict-retry";

export const INVALID_INVITATION = "El código no es válido, ya fue utilizado o venció.";

export async function redeemInvitationWithDb({ db, userId, codeHash, profileData }: { db: PrismaClient; userId: string; codeHash: string; profileData?: { displayName?: string } }) {
  const pointer = await db.invitationCode.findFirst({ where: { codeHash }, select: { id: true, centerId: true } });
  if (!pointer) throw new DomainError(INVALID_INVITATION);
  const displayName = profileData?.displayName?.trim() || undefined;
  return retryTransactionConflicts(() => db.$transaction(async (tx) => {
    const [center] = await tx.$queryRaw<{ id: string; active: boolean }[]>(Prisma.sql`SELECT "id", "active" FROM "Center" WHERE "id" = ${pointer.centerId} FOR UPDATE`);
    const [invitation] = await tx.$queryRaw<{ id: string; centerId: string; codeHash: string; role: string; expiresAt: Date; revokedAt: Date | null; redeemedAt: Date | null; redeemedByUserId: string | null }[]>(Prisma.sql`SELECT "id", "centerId", "codeHash", "role", "expiresAt", "revokedAt", "redeemedAt", "redeemedByUserId" FROM "InvitationCode" WHERE "id" = ${pointer.id} FOR UPDATE`);
    const now = new Date();
    if (!center?.active || !invitation || invitation.centerId !== pointer.centerId || invitation.codeHash !== codeHash) throw new DomainError(INVALID_INVITATION);
    const member = await tx.centerMember.findUnique({ where: { centerId_userId: { centerId: pointer.centerId, userId } } });
    if (invitation.redeemedAt) {
      if (invitation.redeemedByUserId !== userId || !member?.active) throw new DomainError(INVALID_INVITATION);
      return pointer.centerId;
    }
    if (invitation.revokedAt || invitation.expiresAt <= now || member?.active === false) throw new DomainError(INVALID_INVITATION);
    const profile = await tx.profile.findUnique({ where: { id: userId }, select: { displayName: true } });
    if (!profile) await tx.profile.create({ data: { id: userId, ...(displayName ? { displayName } : {}) } });
    else if (!profile.displayName && displayName) await tx.profile.update({ where: { id: userId }, data: { displayName } });
    if (!member?.active) await tx.centerMember.create({ data: { centerId: pointer.centerId, userId, role: invitation.role } });
    const claim = await tx.invitationCode.updateMany({ where: { id: invitation.id, codeHash, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { redeemedAt: now, redeemedByUserId: userId } });
    if (claim.count !== 1) throw new DomainError(INVALID_INVITATION);
    return pointer.centerId;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

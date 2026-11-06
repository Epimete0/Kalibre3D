import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INVITATION_DAYS, MAX_ACTIVE_INVITATIONS, invitableRoles, invitationStatus, type TeamRole } from "@/lib/team-rules";

/**
 * Invitaciones para sumar personas al taller. Un código es de un solo uso y vence a los 7 días; **se muestra una sola vez** (en la
 * base solo queda su huella SHA-256). Solo OWNER y ADMIN crean y revocan; un administrador solo invita ayudantes o lectores.
 * El canje vive en `invitation-service-core.ts`.
 */

export type __InvitationTestDeps = { prisma: PrismaClient; auth: { centerId: string; userId: string; role: TeamRole } };

/** Mayúsculas, sin separadores y en grupos de 4 con guiones: «a1b2c3d4» → «A1B2-C3D4». Los códigos anteriores (10 caracteres) siguen igual. */
export function normalizeInvitationCode(input: string) {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.match(/.{1,4}/g)?.join("-") ?? "";
}

export const hashInvitationCode = (code: string) => createHash("sha256").update(normalizeInvitationCode(code)).digest("hex");

const newCode = () => normalizeInvitationCode(randomBytes(8).toString("hex"));

export async function createInvitation(role: string, deps?: __InvitationTestDeps) {
  const auth = deps?.auth ?? await requireCatalogContext();
  const db = deps?.prisma ?? prisma;
  if (!invitableRoles(auth.role).includes(role as TeamRole)) throw new DomainError(auth.role === "ADMIN" ? "Un administrador solo puede invitar ayudantes o personas de consulta." : "El rol elegido no es válido.");
  const now = new Date();
  const active = await db.invitationCode.count({ where: { centerId: auth.centerId, redeemedAt: null, revokedAt: null, expiresAt: { gt: now } } });
  if (active >= MAX_ACTIVE_INVITATIONS) throw new DomainError(`Ya hay ${MAX_ACTIVE_INVITATIONS} invitaciones activas. Revoca alguna antes de crear otra.`);
  const expiresAt = new Date(now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = newCode();
    try {
      await db.invitationCode.create({ data: { codeHash: hashInvitationCode(code), role, expiresAt, createdByUserId: auth.userId, centerId: auth.centerId } });
      return { code, role: role as TeamRole, expiresAt };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") continue; // huella repetida: casi imposible, se reintenta con otro código
      throw error;
    }
  }
  throw new DomainError("No fue posible crear la invitación. Intenta nuevamente.");
}

export async function revokeInvitation(id: string, deps?: __InvitationTestDeps) {
  const auth = deps?.auth ?? await requireCatalogContext();
  const db = deps?.prisma ?? prisma;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DomainError("La invitación no existe.");
  const result = await db.invitationCode.updateMany({ where: { id, centerId: auth.centerId, redeemedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!result.count) throw new DomainError("La invitación no existe o ya no se puede revocar.");
}

export async function listInvitations(deps?: __InvitationTestDeps) {
  const auth = deps?.auth ?? await requireCatalogContext();
  const db = deps?.prisma ?? prisma;
  const now = new Date();
  const rows = await db.invitationCode.findMany({ where: { centerId: auth.centerId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, role: true, createdAt: true, expiresAt: true, redeemedAt: true, revokedAt: true } });
  return rows.map((row) => ({ id: row.id, role: row.role as TeamRole, createdAt: row.createdAt, expiresAt: row.expiresAt, status: invitationStatus(row, now) }));
}

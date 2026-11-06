import { prisma } from "@/lib/prisma";

/**
 * Pasos de registro que ocurren antes de tener una sesión (por eso no abren con un contexto de autorización).
 * Viven aquí y no en la Server Action para que las acciones nunca importen Prisma.
 */

/** ¿Existe una invitación vigente, sin usar y de un taller activo con esa huella? */
export async function isInvitationUsable(codeHash: string) {
  return Boolean(await prisma.invitationCode.findFirst({ where: { codeHash, revokedAt: null, redeemedAt: null, expiresAt: { gt: new Date() }, center: { active: true } }, select: { id: true } }));
}

export async function profileExists(userId: string) {
  return Boolean(await prisma.profile.findUnique({ where: { id: userId }, select: { id: true } }));
}

/** Crea el perfil si no existe (con el nombre visible si se indicó). Nunca pisa un perfil existente. */
export async function ensureProfile(userId: string, displayName: string) {
  await prisma.profile.upsert({ where: { id: userId }, create: { id: userId, ...(displayName ? { displayName } : {}) }, update: {} });
}

/**
 * Reglas de quién puede cambiarle el rol o el estado a quién dentro de un taller. Lógica pura.
 *
 * - OWNER administra a todas las personas (menos a sí misma para desactivarse) y es el único que asigna o quita ADMIN.
 * - ADMIN solo administra a PROFESSIONAL y VIEWER, y solo entre esos dos roles.
 * - OWNER nunca se asigna desde la pantalla (no hay traspaso de propiedad); un OWNER sí puede dejar de serlo si queda otro.
 * - El taller siempre conserva al menos un OWNER activo (lo comprueba el servicio con bloqueo y la base de datos).
 */

export type TeamRole = "OWNER" | "ADMIN" | "PROFESSIONAL" | "VIEWER";
export const ASSIGNABLE_ROLES: TeamRole[] = ["ADMIN", "PROFESSIONAL", "VIEWER"];
export const ROLE_LABEL: Record<TeamRole, string> = { OWNER: "Dueño", ADMIN: "Administrador", PROFESSIONAL: "Ayudante", VIEWER: "Solo consulta" };

export type TeamActor = { userId: string; role: TeamRole };
export type TeamTarget = { userId: string; role: TeamRole; active: boolean };

const isManager = (role: TeamRole) => role === "OWNER" || role === "ADMIN";

/** ¿Puede esta persona tocar a la otra en general? Devuelve el motivo si no. */
function canTouch(actor: TeamActor, target: TeamTarget): string | null {
  if (!isManager(actor.role)) return "No tienes permisos para administrar al equipo.";
  if (actor.role === "ADMIN" && (target.role === "OWNER" || target.role === "ADMIN")) return "Solo un dueño puede administrar a un dueño o a otro administrador.";
  return null;
}

/** Cambiar el rol. `nextOwnerCount` = dueños activos que quedarían, sin contar a la persona cambiada. */
export function validateRoleChange(actor: TeamActor, target: TeamTarget, nextRole: string, remainingOwners: number): string | null {
  const denied = canTouch(actor, target);
  if (denied) return denied;
  if (!ASSIGNABLE_ROLES.includes(nextRole as TeamRole)) return "El rol elegido no es válido.";
  if (!target.active) return "Reactiva a la persona antes de cambiarle el rol.";
  if (target.role === nextRole) return "La persona ya tiene ese rol.";
  if (actor.role === "ADMIN") {
    if (actor.userId === target.userId) return "No puedes cambiar tu propio rol.";
    if (nextRole === "ADMIN") return "Solo un dueño puede nombrar administradores.";
  }
  if (target.role === "OWNER" && remainingOwners < 1) return "El taller debe conservar al menos un dueño activo.";
  return null;
}

/** Desactivar o reactivar (baja lógica). */
export function validateActiveChange(actor: TeamActor, target: TeamTarget, nextActive: boolean, remainingOwners: number): string | null {
  const denied = canTouch(actor, target);
  if (denied) return denied;
  if (target.active === nextActive) return nextActive ? "La persona ya está activa." : "La persona ya está desactivada.";
  if (!nextActive && actor.userId === target.userId) return "No puedes desactivarte a ti misma.";
  if (!nextActive && target.role === "OWNER" && remainingOwners < 1) return "El taller debe conservar al menos un dueño activo.";
  return null;
}

/** Roles que puede invitar quien está creando la invitación. */
export function invitableRoles(actorRole: TeamRole): TeamRole[] {
  if (actorRole === "OWNER") return ["ADMIN", "PROFESSIONAL", "VIEWER"];
  if (actorRole === "ADMIN") return ["PROFESSIONAL", "VIEWER"];
  return [];
}

/** Roles a los que se puede pasar a una persona concreta desde la pantalla. */
export function roleOptionsFor(actor: TeamActor, target: TeamTarget): TeamRole[] {
  if (canTouch(actor, target) || !target.active) return [];
  if (actor.role === "ADMIN" && actor.userId === target.userId) return [];
  const base: TeamRole[] = actor.role === "OWNER" ? ["ADMIN", "PROFESSIONAL", "VIEWER"] : ["PROFESSIONAL", "VIEWER"];
  return base.filter((role) => role !== target.role);
}

/** ¿Se le muestran los botones de desactivar/reactivar? */
export function canToggleActive(actor: TeamActor, target: TeamTarget): boolean {
  if (canTouch(actor, target)) return false;
  return !(target.active && actor.userId === target.userId);
}

export type InvitationStatus = "ACTIVE" | "REDEEMED" | "REVOKED" | "EXPIRED";
export const INVITATION_LABEL: Record<InvitationStatus, string> = { ACTIVE: "Activa", REDEEMED: "Canjeada", REVOKED: "Revocada", EXPIRED: "Vencida" };

export function invitationStatus(invitation: { redeemedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now: Date): InvitationStatus {
  if (invitation.redeemedAt) return "REDEEMED";
  if (invitation.revokedAt) return "REVOKED";
  return invitation.expiresAt <= now ? "EXPIRED" : "ACTIVE";
}

export const INVITATION_DAYS = 7;
export const MAX_ACTIVE_INVITATIONS = 25;

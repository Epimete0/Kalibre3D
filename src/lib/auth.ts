import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOptionalCenterId, selectActiveMembership, type ActiveMembership } from "./active-center";
import { DomainError } from "./action-errors";

export const CENTER_COOKIE = "saas3d-center-id";
export const ROLES = ["OWNER", "ADMIN", "PROFESSIONAL", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export type AuthContext = {
  userId: string;
  centerId: string;
  role: Role;
  timeZone: string | null;
};

export type SessionMembershipState = {
  userId: string;
  profile: { displayName: string | null } | null;
  memberships: ActiveMembership[];
  activeContext: AuthContext | null;
};

export type AccountSummary = {
  displayName: string | null;
  centerName: string;
  /** Rol en el taller activo: define qué secciones ve (p. ej. Rentabilidad solo para quien administra). */
  role: Role;
  /** Identifican la sesión en el navegador (p. ej. para que los borradores de formularios no se mezclen entre personas ni talleres). */
  userId: string;
  centerId: string;
};

export async function getActiveMemberships(userId: string): Promise<ActiveMembership[]> {
  const memberships = await prisma.centerMember.findMany({
    where: { userId, active: true, center: { active: true } },
    include: { center: { select: { name: true, timeZone: true } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((membership) => ({ centerId: membership.centerId, role: membership.role as Role, center: membership.center }));
}

export async function resolveActiveMembership(userId: string, requestedCenterId?: unknown) {
  const memberships = await getActiveMemberships(userId);
  return selectActiveMembership(memberships, requestedCenterId);
}

export async function requireSessionUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  return userId;
}

/** Only onboarding and profile screens may tolerate an authenticated user without memberships. */
export async function getSessionMembershipState(): Promise<SessionMembershipState> {
  const userId = await requireSessionUser();
  const requestedCenterId = (await cookies()).get(CENTER_COOKIE)?.value;
  const [profile, memberships] = await Promise.all([
    prisma.profile.findUnique({ where: { id: userId }, select: { displayName: true } }),
    getActiveMemberships(userId),
  ]);
  const active = selectActiveMembership(memberships, requestedCenterId);
  return { userId, profile, memberships, activeContext: active ? { userId, centerId: active.centerId, role: active.role, timeZone: active.center.timeZone } : null };
}

export async function getAccountSummary(): Promise<AccountSummary | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;
  const requestedCenterId = (await cookies()).get(CENTER_COOKIE)?.value;
  const [membership, profile] = await Promise.all([
    resolveActiveMembership(userId, requestedCenterId),
    prisma.profile.findUnique({ where: { id: userId }, select: { displayName: true } }),
  ]);
  return membership ? { centerName: membership.center.name, displayName: profile?.displayName ?? null, role: membership.role, userId, centerId: membership.centerId } : null;
}

export async function requireAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");

  const requestedCenterId = parseOptionalCenterId((await cookies()).get(CENTER_COOKIE)?.value);
  const membership = await resolveActiveMembership(userId, requestedCenterId);
  if (!membership) redirect("/login?error=membership");
  return { userId, centerId: membership.centerId, role: membership.role, timeZone: membership.center.timeZone };
}

export function requireRole(context: AuthContext, roles: Role[]) {
  // DomainError: el mensaje llega al usuario tal cual (safeActionError oculta cualquier otro Error).
  if (!roles.includes(context.role)) throw new DomainError("No tienes permisos para realizar esta acción.");
}

export function canManageCatalog(role: Role) {
  return role === "OWNER" || role === "ADMIN";
}

export async function requireCatalogContext() {
  const context = await requireAuthContext();
  if (!canManageCatalog(context.role)) throw new DomainError("No tienes permisos para realizar esta acción.");
  return context;
}

export async function requireOperationalContext() {
  const context = await requireAuthContext();
  requireRole(context, ["OWNER", "ADMIN", "PROFESSIONAL"]);
  return context;
}

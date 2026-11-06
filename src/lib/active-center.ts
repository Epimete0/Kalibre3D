import { z } from "zod";
import type { Role } from "./auth";

export const centerIdSchema = z.string().uuid("El taller seleccionado no es válido.").transform((value) => value.toLowerCase());

export type ActiveMembership = {
  centerId: string;
  role: Role;
  center: { name: string; timeZone: string | null };
};

export function parseCenterId(value: unknown) {
  return centerIdSchema.parse(value);
}

export function parseOptionalCenterId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = centerIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function selectActiveMembership(memberships: ActiveMembership[], requestedCenterId: unknown) {
  const requested = parseOptionalCenterId(requestedCenterId);
  return memberships.find((membership) => membership.centerId === requested) ?? memberships[0];
}

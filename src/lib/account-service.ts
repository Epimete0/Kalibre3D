import { z } from "zod";
import { DomainError } from "@/lib/action-errors";
import { requireCatalogContext, requireSessionUser } from "@/lib/auth";
import { validateIanaTimeZone } from "@/lib/center-time-zone";
import { prisma } from "@/lib/prisma";

/** Datos de la cuenta de la persona y del taller activo. */

export const DISPLAY_NAME_MAX = 80;
export const CENTER_NAME_MAX = 100;

const displayNameSchema = z.string({ error: "Escribe tu nombre." }).trim().min(1, "Escribe tu nombre.").max(DISPLAY_NAME_MAX, `El nombre es demasiado largo (máximo ${DISPLAY_NAME_MAX} caracteres).`);
const centerNameSchema = z.string({ error: "Escribe el nombre del taller." }).trim().min(1, "Escribe el nombre del taller.").max(CENTER_NAME_MAX, `El nombre es demasiado largo (máximo ${CENTER_NAME_MAX} caracteres).`);

/** Nombre visible de la persona (aparece en el equipo, los pedidos y la actividad). */
export async function updateDisplayName(formData: FormData) {
  const userId = await requireSessionUser();
  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) throw new DomainError(parsed.error.issues[0]?.message ?? "El nombre no es válido.");
  await prisma.profile.upsert({ where: { id: userId }, create: { id: userId, displayName: parsed.data }, update: { displayName: parsed.data } });
  return { displayName: parsed.data };
}

/**
 * Nombre y zona horaria del taller activo, en una sola escritura: si algo no es válido no se guarda nada.
 * Solo OWNER y ADMIN. saas3d no porta el límite de 30 días para renombrar de Kurova.
 */
export async function updateCenterSettings(formData: FormData) {
  const { centerId } = await requireCatalogContext();
  const name = centerNameSchema.safeParse(formData.get("name"));
  if (!name.success) throw new DomainError(name.error.issues[0]?.message ?? "El nombre no es válido.");
  const submitted = formData.get("timeZone");
  if (typeof submitted !== "string") throw new DomainError("La zona horaria del taller no es válida.");
  let timeZone: string;
  try { timeZone = validateIanaTimeZone(submitted.trim()); } catch { throw new DomainError("La zona horaria del taller no es válida."); }
  const result = await prisma.center.updateMany({ where: { id: centerId, active: true }, data: { name: name.data, timeZone } });
  if (result.count !== 1) throw new DomainError("No fue posible actualizar los datos del taller. Intenta nuevamente.");
  return { name: name.data, timeZone };
}

export const PASSWORD_MIN = 8;

/** Valida el cambio de contraseña (la contraseña la guarda el proveedor de autenticación, no esta aplicación). */
export function parsePasswordChange(formData: FormData): string {
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < PASSWORD_MIN) throw new DomainError(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
  if (next.length > 72) throw new DomainError("La contraseña es demasiado larga (máximo 72 caracteres).");
  if (next !== confirm) throw new DomainError("Las contraseñas no coinciden.");
  return next;
}

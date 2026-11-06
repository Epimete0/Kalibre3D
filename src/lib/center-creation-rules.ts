import { z } from "zod";
import { DomainError } from "@/lib/action-errors";

/** Reglas puras de la creación de un taller (sin base de datos ni sesión): las usan el servicio y el formulario del navegador. */

export const MAX_OWNED_CENTERS = 1;
export const CENTER_NAME_MIN = 2;
export const CENTER_NAME_MAX = 80;

export const CENTER_TIME_ZONES = [
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)" },
  { value: "America/Guayaquil", label: "Ecuador (Guayaquil)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
  { value: "UTC", label: "UTC" },
] as const;

export const DEFAULT_CENTER_TIME_ZONE = "America/Santiago";

export const GENERIC_CENTER_ERROR = "No fue posible crear el taller. Intenta nuevamente.";
export const CENTER_LIMIT_MESSAGE = "Ya tienes un taller propio. Por ahora cada persona puede crear uno.";

const INVALID_FORM = "El formulario no es válido. Recarga la página.";
const timeZones = CENTER_TIME_ZONES.map((zone) => zone.value) as [string, ...string[]];

export const createCenterSchema = z.object({
  centerId: z.string({ error: INVALID_FORM }).uuid(INVALID_FORM),
  name: z.string({ error: "Escribe el nombre del taller." }).transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(CENTER_NAME_MIN, `El nombre del taller debe tener al menos ${CENTER_NAME_MIN} caracteres.`).max(CENTER_NAME_MAX, `El nombre del taller puede tener hasta ${CENTER_NAME_MAX} caracteres.`)),
  timeZone: z.enum(timeZones, { error: "Elige la zona horaria del taller." }),
});

export type CreateCenterInput = z.infer<typeof createCenterSchema>;

export function parseCreateCenter(formData: FormData) {
  const parsed = createCenterSchema.safeParse({ centerId: formData.get("centerId"), name: formData.get("name"), timeZone: formData.get("timeZone") });
  if (!parsed.success) throw new DomainError(parsed.error.issues.map((issue) => issue.message).join(" · "));
  return parsed.data;
}

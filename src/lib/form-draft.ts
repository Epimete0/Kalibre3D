/**
 * Borradores de formulario en el navegador (solo en este dispositivo; no viajan al servidor).
 *
 * Cada borrador se guarda con una clave por usuario, taller, formulario y registro, caduca a los 7 días y se borra al guardar
 * bien, al descartar o al cerrar sesión. Todas las lecturas y escrituras toleran que el almacenamiento no exista o falle
 * (ventana privada, datos bloqueados, cuota llena): sin él, los formularios funcionan igual, solo que sin borrador.
 */

export const DRAFT_PREFIX = "saas3d:draft:";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERSION = 1;
/** Un borrador más grande que esto no se guarda (evita llenar la cuota del navegador). */
const MAX_BYTES = 200_000;

export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
export type StoredDraft<T> = { data: T; savedAt: number };

export function draftScope(userId: string, centerId: string) {
  return `${userId}:${centerId}`;
}

export function draftKey(scope: string, form: string, recordId?: string | null) {
  return `${DRAFT_PREFIX}${scope}:${form}:${recordId || "new"}`;
}

export function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDraft<T>(storage: DraftStorage | null, key: string, now = Date.now()): StoredDraft<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: number; savedAt?: number; data?: T };
    if (parsed?.v !== VERSION || typeof parsed.savedAt !== "number" || parsed.data === undefined || now - parsed.savedAt > DRAFT_TTL_MS || parsed.savedAt > now + 60_000) {
      storage.removeItem(key);
      return null;
    }
    return { data: parsed.data, savedAt: parsed.savedAt };
  } catch {
    try { storage.removeItem(key); } catch { /* sin almacenamiento */ }
    return null;
  }
}

export function writeDraft<T>(storage: DraftStorage | null, key: string, data: T, now = Date.now()): boolean {
  if (!storage) return false;
  try {
    const raw = JSON.stringify({ v: VERSION, savedAt: now, data });
    if (raw.length > MAX_BYTES) return false;
    storage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(storage: DraftStorage | null, key: string) {
  try { storage?.removeItem(key); } catch { /* sin almacenamiento */ }
}

function draftKeys(storage: DraftStorage) {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
  }
  return keys;
}

/** Cierre de sesión: no deja ningún borrador en el dispositivo. */
export function clearAllDrafts(storage: DraftStorage | null) {
  if (!storage) return;
  try { for (const key of draftKeys(storage)) storage.removeItem(key); } catch { /* sin almacenamiento */ }
}

/** Al abrir un formulario: quita lo vencido y lo que pertenece a otro usuario u otro taller. */
export function purgeStaleDrafts(storage: DraftStorage | null, scope: string, now = Date.now()) {
  if (!storage) return;
  try {
    for (const key of draftKeys(storage)) {
      if (!key.startsWith(`${DRAFT_PREFIX}${scope}:`)) { storage.removeItem(key); continue; }
      readDraft(storage, key, now); // quita el vencido o ilegible
    }
  } catch { /* sin almacenamiento */ }
}

/** Texto para el aviso de recuperación: «hace 5 minutos», «ayer»… */
export function describeDraftAge(savedAt: number, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - savedAt) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}

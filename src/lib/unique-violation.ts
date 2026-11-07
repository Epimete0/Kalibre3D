/**
 * Cuando dos personas crean lo mismo a la vez, la validación previa de la Server Action puede no verlo y quien frena el duplicado
 * es el índice único de PostgreSQL. Este traductor convierte ese rechazo (P2002 de Prisma) en el mismo mensaje claro que da la
 * validación previa, en vez de un error genérico.
 */

const MESSAGES: { index: RegExp; message: string }[] = [
  { index: /^Product_.*name_key$/, message: "Ya existe una pieza con ese nombre." },
  // Subcategory antes que Category: «Subcategory_…» también contiene «category» al final del prefijo.
  { index: /^Subcategory_.*normalized_name_key$/, message: "Ya existe un tipo con ese nombre." },
  { index: /^Category_.*normalized_name_key$/, message: "Ya existe una categoría con ese nombre." },
  { index: /^Brand_.*normalized_name_key$/, message: "Ya existe una marca con ese nombre." },
  { index: /^Supplier_.*normalized_name_key$/, message: "Ya existe un proveedor con ese nombre." },
  { index: /^Service_.*normalized_name_key$/, message: "Ya existe un servicio con ese nombre." },
];

type PrismaLikeError = { code?: unknown; message?: unknown; meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: { index?: unknown } } } } };

function violatedIndex(error: PrismaLikeError): string | undefined {
  const fromAdapter = error.meta?.driverAdapterError?.cause?.constraint?.index;
  if (typeof fromAdapter === "string") return fromAdapter;
  const target = error.meta?.target;
  if (typeof target === "string") return target;
  if (Array.isArray(target) && typeof target[0] === "string") return target[0];
  const match = typeof error.message === "string" ? /constraint:\s*[`"']?([A-Za-z0-9_]+)/.exec(error.message) : null;
  return match?.[1];
}

/** El mensaje claro si el error es un nombre repetido rechazado por la base de datos; si no, `null`. */
export function uniqueViolationMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as PrismaLikeError;
  if (candidate.code !== "P2002") return null;
  const index = violatedIndex(candidate);
  if (!index) return null;
  return MESSAGES.find((entry) => entry.index.test(index))?.message ?? null;
}

/** Indica si el error corresponde a una violación de índice único (P2002), opcionalmente filtrada por el nombre del índice. */
export function isUniqueViolation(error: unknown, indexName?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as PrismaLikeError;
  if (candidate.code !== "P2002") return false;
  if (!indexName) return true;
  const index = violatedIndex(candidate);
  return index === indexName;
}

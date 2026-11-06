import { ZodError } from "zod";
import { safeActionError } from "@/lib/action-errors";
import { uniqueViolationMessage } from "@/lib/unique-violation";

export type ActionFailure = { error: string };

/** Mensaje para mostrar cuando una acción falla: lo de validación (Zod) y de dominio se dice tal cual; lo inesperado, genérico. */
export function actionFailure(error: unknown, fallback: string): ActionFailure {
  if (error instanceof ZodError) return { error: error.issues[0]?.message ?? fallback };
  const duplicate = uniqueViolationMessage(error); // dos altas simultáneas: lo frena el índice único y se dice con claridad
  if (duplicate) return { error: duplicate };
  return { error: safeActionError(error, fallback) };
}

export class DomainError extends Error {
  readonly isDomainError = true;
}

export function safeActionError(error: unknown, fallback: string): string {
  if (error instanceof DomainError) return error.message;
  console.error("Unexpected server action error", error);
  return fallback;
}

const RETRYABLE_TRANSACTION_CODES = new Set(["P2034", "40001", "40P01"]);
const NESTED_ERROR_KEYS = ["cause", "meta", "driverAdapterError"] as const;
const MAX_ERROR_DEPTH = 6;

export const MAX_TRANSACTION_ATTEMPTS = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRetryableTransactionConflict(error: unknown): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  const visited = new WeakSet<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || !isRecord(current.value) || visited.has(current.value)) continue;
    visited.add(current.value);

    if (
      (typeof current.value.code === "string" && RETRYABLE_TRANSACTION_CODES.has(current.value.code))
      || (typeof current.value.originalCode === "string" && RETRYABLE_TRANSACTION_CODES.has(current.value.originalCode))
      || current.value.kind === "TransactionWriteConflict"
    ) return true;

    if (current.depth >= MAX_ERROR_DEPTH) continue;
    for (const key of NESTED_ERROR_KEYS) {
      pending.push({ value: current.value[key], depth: current.depth + 1 });
    }
  }

  return false;
}

export async function retryTransactionConflicts<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionConflict(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }

  throw new Error("Unreachable transaction retry state.");
}

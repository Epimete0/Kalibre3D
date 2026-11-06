import { describe, expect, it, vi } from "vitest";
import { DomainError } from "./action-errors";
import { isRetryableTransactionConflict, retryTransactionConflicts } from "./transaction-conflict-retry";

describe("isRetryableTransactionConflict", () => {
  it.each([
    ["Prisma P2034", { code: "P2034" }],
    ["direct SQLSTATE 40001", { code: "40001" }],
    ["adapter originalCode 40001", { originalCode: "40001" }],
    ["nested adapter-pg 40001", {
      code: "P2010",
      meta: {
        driverAdapterError: {
          cause: { kind: "TransactionWriteConflict", originalCode: "40001" },
        },
      },
    }],
    ["adapter originalCode 40P01", { originalCode: "40P01" }],
  ])("recognizes %s structurally", (_name, error) => {
    expect(isRetryableTransactionConflict(error)).toBe(true);
  });

  it("terminates on a cyclic cause graph", () => {
    const error: Record<string, unknown> = {};
    const cause = { meta: error };
    error.cause = cause;

    expect(isRetryableTransactionConflict(error)).toBe(false);
  });

  it("rejects an object without an error code", () => {
    expect(isRetryableTransactionConflict({ meta: { detail: "conflict" } })).toBe(false);
  });

  it("rejects non-retryable SQLSTATE 23505", () => {
    expect(isRetryableTransactionConflict({ originalCode: "23505" })).toBe(false);
  });

  it("does not traverse beyond the maximum depth of six", () => {
    let error: Record<string, unknown> = { originalCode: "40001" };
    for (let depth = 0; depth < 7; depth += 1) error = { cause: error };

    expect(isRetryableTransactionConflict(error)).toBe(false);
  });

  it("never classifies retryability from an error message", () => {
    expect(isRetryableTransactionConflict({ message: "P2034 40001 40P01 TransactionWriteConflict" })).toBe(false);
  });
});

describe("retryTransactionConflicts", () => {
  it("stops after exactly three retryable failures and propagates the final conflict", async () => {
    const conflicts = [
      { code: "P2034", attempt: 1 },
      { originalCode: "40001", attempt: 2 },
      { originalCode: "40P01", attempt: 3 },
    ];
    const operation = vi.fn()
      .mockRejectedValueOnce(conflicts[0])
      .mockRejectedValueOnce(conflicts[1])
      .mockRejectedValueOnce(conflicts[2]);

    await expect(retryTransactionConflicts(operation)).rejects.toBe(conflicts[2]);

    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("returns a successful second attempt", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce({ code: "40001" })
      .mockResolvedValueOnce("success");

    await expect(retryTransactionConflicts(operation)).resolves.toBe("success");

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry a functional error", async () => {
    const error = new DomainError("La operación no está permitida.");
    const operation = vi.fn().mockRejectedValue(error);

    await expect(retryTransactionConflicts(operation)).rejects.toBe(error);

    expect(operation).toHaveBeenCalledTimes(1);
  });
});

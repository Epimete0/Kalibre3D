import { describe, expect, it, vi } from "vitest";
import { DomainError, safeActionError } from "./action-errors";

describe("action errors", () => {
  it("preserves known domain errors", () => {
    expect(safeActionError(new DomainError("La atención ya fue anulada"), "No fue posible completar la acción. Intenta nuevamente.")).toBe("La atención ya fue anulada");
  });

  it("hides unexpected error details and logs them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(safeActionError(new Error("Prisma secret detail"), "No fue posible completar la acción. Intenta nuevamente.")).toBe("No fue posible completar la acción. Intenta nuevamente.");
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls.flat().join(" ")).toContain("Prisma secret detail");
    spy.mockRestore();
  });
});

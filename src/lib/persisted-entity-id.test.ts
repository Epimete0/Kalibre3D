import { describe, expect, it } from "vitest";
import { persistedEntityId } from "./persisted-entity-id";

describe("persistedEntityId", () => {
  it.each([
    "ckaaaaaaaaaaaaaaaaaaaaaa",
    "550e8400-e29b-41d4-a716-446655440000",
  ])("acepta un identificador persistido válido: %s", (value) => {
    expect(persistedEntityId.safeParse(value).success).toBe(true);
  });

  it.each(["", "   ", "not-an-id", "x".repeat(65)])("rechaza un identificador inválido: %s", (value) => {
    const result = persistedEntityId.safeParse(value);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Identificador inválido.");
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodFieldErrors } from "./validation-errors";

describe("zodFieldErrors", () => {
  it("collects every issue and joins repeated fields", () => {
    const result = z.object({ name: z.string().min(3).email(), "items": z.array(z.object({ quantity: z.number().positive() })) }).safeParse({ name: "x", items: [{ quantity: 0 }] });
    if (result.success) throw new Error("expected invalid input");
    expect(zodFieldErrors(result.error)).toEqual({ name: "Too small: expected string to have >=3 characters · Invalid email address", "items.0.quantity": "Too small: expected number to be >0" });
  });
});

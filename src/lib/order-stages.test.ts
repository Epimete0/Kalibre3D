import { describe, expect, it } from "vitest";
import { ORDER_STAGES, STAGE_MEANING, STAGE_WHEN, stageIndex } from "./order-stages";
import { nextStatuses } from "./order-status";

describe("etapas visibles de un pedido por encargo", () => {
  it("siguen exactamente el camino de avance permitido", () => {
    for (let i = 0; i < ORDER_STAGES.length - 1; i += 1) {
      expect(nextStatuses(ORDER_STAGES[i])).toContain(ORDER_STAGES[i + 1]);
    }
  });

  it("cada etapa explica qué significa y cuándo avanzar, con mayúscula inicial y punto final", () => {
    for (const stage of ORDER_STAGES) {
      expect(STAGE_MEANING[stage]).toMatch(/^[A-ZÁÉÍÓÚÑ].*\.$/);
      if (stage !== "QUOTED") expect(STAGE_WHEN[stage]).toMatch(/^[A-ZÁÉÍÓÚÑ].*\.$/);
    }
  });

  it("ubica la etapa actual y deja fuera cancelados y devueltos", () => {
    expect(stageIndex("QUOTED")).toBe(0);
    expect(stageIndex("READY")).toBe(3);
    expect(stageIndex("CANCELED")).toBe(-1);
    expect(stageIndex("RETURNED")).toBe(-1);
  });
});

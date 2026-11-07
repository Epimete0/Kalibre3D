import { describe, expect, it } from "vitest";
import { buildGettingStarted, settingsWereSaved } from "./getting-started";

describe("primeros pasos del taller", () => {
  it("un taller nuevo tiene los tres pasos pendientes, en orden", () => {
    const result = buildGettingStarted({ hasOrder: false, settingsConfigured: false, hasSpool: false });
    expect(result.steps.map((step) => step.key)).toEqual(["first-sale", "costs", "first-spool"]);
    expect(result.completed).toBe(0);
    expect(result.allDone).toBe(false);
  });

  it("marca cada paso según los hechos y termina cuando están los tres", () => {
    const partial = buildGettingStarted({ hasOrder: true, settingsConfigured: false, hasSpool: true });
    expect(partial.steps.map((step) => step.done)).toEqual([true, false, true]);
    expect(partial.completed).toBe(2);
    expect(partial.allDone).toBe(false);
    expect(buildGettingStarted({ hasOrder: true, settingsConfigured: true, hasSpool: true }).allDone).toBe(true);
  });

  it("la configuración solo cuenta como revisada si se guardó después de crearse", () => {
    const createdAt = new Date("2026-11-07T10:00:00.000Z");
    expect(settingsWereSaved(null)).toBe(false);
    expect(settingsWereSaved({ createdAt, updatedAt: createdAt })).toBe(false);
    expect(settingsWereSaved({ createdAt, updatedAt: new Date("2026-11-07T10:00:00.500Z") })).toBe(false);
    expect(settingsWereSaved({ createdAt, updatedAt: new Date("2026-11-07T10:05:00.000Z") })).toBe(true);
  });
});

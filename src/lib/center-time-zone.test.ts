import { describe, expect, it } from "vitest";
import {
  centerDayBoundsToUtc,
  centerLocalDateTimeToUtc,
  centerNowFields,
  formatInCenterTimeZone,
  validateIanaTimeZone,
} from "./center-time-zone";

describe("center time zone", () => {
  it("accepts and canonicalizes an IANA time zone", () => {
    expect(validateIanaTimeZone("America/Santiago")).toBe("America/Santiago");
    expect(validateIanaTimeZone("america/new_york")).toBe("America/New_York");
  });

  it.each(["", "GMT-4", "America/Does_Not_Exist"])("rejects an invalid time zone: %s", (timeZone) => {
    expect(() => validateIanaTimeZone(timeZone)).toThrow("La zona horaria del taller no es válida.");
  });

  it("converts winter and summer Santiago local times to UTC", () => {
    expect(centerLocalDateTimeToUtc({ date: "2026-07-15", time: "12:00", timeZone: "America/Santiago" }).toISOString()).toBe("2026-07-15T16:00:00.000Z");
    expect(centerLocalDateTimeToUtc({ date: "2026-01-15", time: "12:00", timeZone: "America/Santiago" }).toISOString()).toBe("2026-01-15T15:00:00.000Z");
  });

  it("round-trips local date and time through UTC in a second IANA zone", () => {
    const instant = centerLocalDateTimeToUtc({ date: "2026-07-15", time: "12:00", timeZone: "America/New_York" });
    expect(formatInCenterTimeZone(instant, "America/New_York", { dateStyle: "short", timeStyle: "short", hourCycle: "h23" })).toContain("12:00");
  });

  it("does not depend on the server or browser time zone", () => {
    const instant = centerLocalDateTimeToUtc({ date: "2026-07-15", time: "12:00", timeZone: "America/Santiago" });
    expect(instant.toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("rejects a nonexistent DST local time", () => {
    expect(() => centerLocalDateTimeToUtc({ date: "2026-09-06", time: "00:30", timeZone: "America/Santiago" })).toThrow("La hora seleccionada no existe en la zona horaria del taller. Elige otra hora.");
  });

  it("rejects an ambiguous DST local time", () => {
    expect(() => centerLocalDateTimeToUtc({ date: "2026-04-04", time: "23:30", timeZone: "America/Santiago" })).toThrow("La hora seleccionada es ambigua por un cambio de horario. Elige otra hora.");
  });

  it("returns normal local-day UTC bounds", () => {
    const bounds = centerDayBoundsToUtc("2026-07-15", "America/Santiago");
    expect(bounds.start.toISOString()).toBe("2026-07-15T04:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-07-16T04:00:00.000Z");
  });

  it("returns DST local-day UTC bounds without assuming 24 hours", () => {
    const bounds = centerDayBoundsToUtc("2026-09-06", "America/Santiago");
    expect(bounds.start.toISOString()).toBe("2026-09-06T04:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-07T03:00:00.000Z");
  });

  it("derives form defaults in the center time zone", () => {
    expect(centerNowFields("America/Santiago", new Date("2026-07-15T01:30:00.000Z"))).toEqual({ date: "2026-07-14", time: "21:30" });
  });
});

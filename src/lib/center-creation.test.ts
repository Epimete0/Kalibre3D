import { describe, expect, it } from "vitest";
import { CENTER_NAME_MAX, CENTER_TIME_ZONES, DEFAULT_CENTER_TIME_ZONE, MAX_OWNED_CENTERS, parseCreateCenter } from "./center-creation-rules";

const id = "550e8400-e29b-41d4-a716-446655440000";
const form = (fields: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; };

describe("crear taller: validación", () => {
  it("acepta un nombre válido, lo limpia y respeta la zona horaria elegida", () => {
    expect(parseCreateCenter(form({ centerId: id, name: "  Estética   Aurora ", timeZone: "America/Bogota" }))).toEqual({ centerId: id, name: "Estética Aurora", timeZone: "America/Bogota" });
  });

  it("rechaza nombres demasiado cortos o largos con un mensaje claro", () => {
    expect(() => parseCreateCenter(form({ centerId: id, name: "A", timeZone: DEFAULT_CENTER_TIME_ZONE }))).toThrow(/al menos 2/);
    expect(() => parseCreateCenter(form({ centerId: id, name: "   ", timeZone: DEFAULT_CENTER_TIME_ZONE }))).toThrow(/al menos 2/);
    expect(() => parseCreateCenter(form({ centerId: id, name: "x".repeat(CENTER_NAME_MAX + 1), timeZone: DEFAULT_CENTER_TIME_ZONE }))).toThrow(/hasta 80/);
  });

  it("solo acepta zonas horarias de la lista", () => {
    expect(() => parseCreateCenter(form({ centerId: id, name: "Taller", timeZone: "Mars/Olympus" }))).toThrow(/zona horaria/);
    expect(() => parseCreateCenter(form({ centerId: id, name: "Taller", timeZone: "Etc/GMT+3" }))).toThrow(/zona horaria/);
    expect(() => parseCreateCenter(form({ centerId: id, name: "Taller", timeZone: "" }))).toThrow(/zona horaria/);
  });

  it("el identificador del taller debe ser un UUID", () => {
    expect(() => parseCreateCenter(form({ centerId: "no-es-uuid", name: "Taller", timeZone: DEFAULT_CENTER_TIME_ZONE }))).toThrow(/Recarga/);
    expect(() => parseCreateCenter(form({ name: "Taller", timeZone: DEFAULT_CENTER_TIME_ZONE }))).toThrow(/Recarga/);
  });

  it("cada persona puede tener un taller propio y la zona por defecto está en la lista", () => {
    expect(MAX_OWNED_CENTERS).toBe(1);
    expect(CENTER_TIME_ZONES.some((zone) => zone.value === DEFAULT_CENTER_TIME_ZONE)).toBe(true);
  });
});

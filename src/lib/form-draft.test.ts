import { describe, expect, it } from "vitest";
import { DRAFT_PREFIX, DRAFT_TTL_MS, clearAllDrafts, clearDraft, describeDraftAge, draftKey, draftScope, purgeStaleDrafts, readDraft, writeDraft, type DraftStorage } from "./form-draft";

function memoryStorage(initial: Record<string, string> = {}): DraftStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); }, removeItem: (key) => { map.delete(key); }, key: (index) => [...map.keys()][index] ?? null, get length() { return map.size; } };
}

const scope = draftScope("user-a", "center-a");
const key = draftKey(scope, "quote", "q1");

describe("form-draft", () => {
  it("la clave separa usuario, taller, formulario y registro", () => {
    expect(draftKey(scope, "purchase")).toBe(`${DRAFT_PREFIX}user-a:center-a:purchase:new`);
    expect(draftKey(scope, "quote", "q1")).not.toBe(draftKey(draftScope("user-b", "center-a"), "quote", "q1"));
    expect(draftKey(scope, "quote", "q1")).not.toBe(draftKey(draftScope("user-a", "center-b"), "quote", "q1"));
  });

  it("guarda y recupera un borrador", () => {
    const storage = memoryStorage();
    expect(writeDraft(storage, key, { name: "Ana" }, 1000)).toBe(true);
    expect(readDraft(storage, key, 2000)).toEqual({ data: { name: "Ana" }, savedAt: 1000 });
  });

  it("descarta y borra un borrador vencido, ilegible, de otra versión o con fecha futura", () => {
    const storage = memoryStorage();
    writeDraft(storage, key, { a: 1 }, 1000);
    expect(readDraft(storage, key, 1000 + DRAFT_TTL_MS + 1)).toBeNull();
    expect(storage.map.has(key)).toBe(false);
    storage.setItem(key, "{no es json");
    expect(readDraft(storage, key)).toBeNull();
    expect(storage.map.has(key)).toBe(false);
    storage.setItem(key, JSON.stringify({ v: 99, savedAt: 1, data: {} }));
    expect(readDraft(storage, key, 2)).toBeNull();
    storage.setItem(key, JSON.stringify({ v: 1, savedAt: 10_000_000, data: {} }));
    expect(readDraft(storage, key, 1)).toBeNull();
  });

  it("no guarda un borrador demasiado grande", () => {
    const storage = memoryStorage();
    expect(writeDraft(storage, key, "x".repeat(300_000))).toBe(false);
    expect(storage.map.size).toBe(0);
  });

  it("sin almacenamiento o con almacenamiento que falla, nada se rompe", () => {
    expect(readDraft(null, key)).toBeNull();
    expect(writeDraft(null, key, {})).toBe(false);
    const broken: DraftStorage = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cuota"); }, removeItem: () => { throw new Error("bloqueado"); }, key: () => null, length: 0 };
    expect(readDraft(broken, key)).toBeNull();
    expect(writeDraft(broken, key, {})).toBe(false);
    expect(() => clearDraft(broken, key)).not.toThrow();
    expect(() => clearAllDrafts(broken)).not.toThrow();
    expect(() => purgeStaleDrafts(broken, scope)).not.toThrow();
  });

  it("cerrar sesión borra todos los borradores y solo los borradores", () => {
    const storage = memoryStorage({ theme: "dark" });
    writeDraft(storage, key, {});
    writeDraft(storage, draftKey(draftScope("user-b", "center-b"), "purchase"), {});
    clearAllDrafts(storage);
    expect([...storage.map.keys()]).toEqual(["theme"]);
  });

  it("al abrir un formulario se purga lo de otro usuario o taller y lo vencido, y se conserva lo vigente", () => {
    const storage = memoryStorage();
    const mine = draftKey(scope, "purchase");
    const other = draftKey(draftScope("user-b", "center-a"), "purchase");
    const old = draftKey(scope, "client");
    writeDraft(storage, mine, { ok: true }, 1_000_000);
    writeDraft(storage, other, {}, 1_000_000);
    writeDraft(storage, old, {}, 1_000_000 - DRAFT_TTL_MS - 5);
    purgeStaleDrafts(storage, scope, 1_000_000);
    expect([...storage.map.keys()]).toEqual([mine]);
  });

  it("describe cuánto hace que se guardó", () => {
    const now = 100 * 24 * 3600_000;
    expect(describeDraftAge(now, now)).toBe("hace un momento");
    expect(describeDraftAge(now - 60_000, now)).toBe("hace 1 minuto");
    expect(describeDraftAge(now - 5 * 60_000, now)).toBe("hace 5 minutos");
    expect(describeDraftAge(now - 3 * 3600_000, now)).toBe("hace 3 horas");
    expect(describeDraftAge(now - 25 * 3600_000, now)).toBe("ayer");
    expect(describeDraftAge(now - 3 * 24 * 3600_000, now)).toBe("hace 3 días");
  });
});

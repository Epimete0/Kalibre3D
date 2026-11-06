import { describe, expect, it } from "vitest";
import { parseCenterId, parseOptionalCenterId, selectActiveMembership, type ActiveMembership } from "./active-center";

const memberships: ActiveMembership[] = [
  { centerId: "11111111-1111-4111-8111-111111111111", role: "OWNER", center: { name: "Primero", timeZone: "America/Santiago" } },
  { centerId: "22222222-2222-4222-8222-222222222222", role: "ADMIN", center: { name: "Segundo", timeZone: null } },
];

describe("active center boundaries", () => {
  it("normaliza UUIDs válidos y descarta valores no confiables", () => {
    expect(parseOptionalCenterId("11111111-1111-4111-8111-111111111111".toUpperCase())).toBe("11111111-1111-4111-8111-111111111111");
    expect(parseOptionalCenterId(" 11111111-1111-4111-8111-111111111111")).toBeNull();
    expect(parseOptionalCenterId("not-a-uuid")).toBeNull();
    expect(parseOptionalCenterId({})).toBeNull();
    expect(parseOptionalCenterId(["11111111-1111-4111-8111-111111111111"])).toBeNull();
    expect(() => parseCenterId("not-a-uuid")).toThrow();
  });

  it("prioriza solo la selección válida y hace fallback determinista", () => {
    expect(selectActiveMembership(memberships, memberships[1].centerId)?.centerId).toBe(memberships[1].centerId);
    expect(selectActiveMembership(memberships, "33333333-3333-4333-8333-333333333333")?.centerId).toBe(memberships[0].centerId);
    expect(selectActiveMembership([], memberships[0].centerId)).toBeUndefined();
  });
});

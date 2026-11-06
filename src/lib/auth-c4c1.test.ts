import { beforeEach, describe, expect, it, vi } from "vitest";

const { getClaims, get, findMany, findUnique, supabase } = vi.hoisted(() => {
  const getClaims = vi.fn();
  const get = vi.fn();
  const findMany = vi.fn();
  const findUnique = vi.fn();
  return { getClaims, get, findMany, findUnique, supabase: { auth: { getClaims } } };
});

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get })) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => supabase) }));
vi.mock("@/lib/prisma", () => ({ prisma: { centerMember: { findMany }, profile: { findUnique } } }));

import { getAccountSummary, getSessionMembershipState } from "./auth";

const activeMemberships = [
  { centerId: "11111111-1111-4111-8111-111111111111", role: "OWNER", center: { name: "Primero", timeZone: "America/Santiago" } },
  { centerId: "22222222-2222-4222-8222-222222222222", role: "ADMIN", center: { name: "Segundo", timeZone: null } },
];

describe("C4C1 auth context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-a" } }, error: null });
    get.mockReturnValue({ value: "malformed-center" });
    findMany.mockResolvedValue(activeMemberships);
    findUnique.mockResolvedValue({ displayName: "Cuenta" });
  });

  it("uses the same active fallback for membership state and account summary", async () => {
    const state = await getSessionMembershipState();
    const summary = await getAccountSummary();

    expect(state.activeContext).toMatchObject({ centerId: activeMemberships[0].centerId, role: "OWNER", timeZone: "America/Santiago" });
    expect(summary).toEqual({ centerName: "Primero", displayName: "Cuenta", role: "OWNER", userId: "user-a", centerId: activeMemberships[0].centerId });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-a", active: true, center: { active: true } }, orderBy: { createdAt: "asc" } }));
  });

  it("does not pass a malformed cookie into a Prisma center filter", async () => {
    await getSessionMembershipState();

    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("centerId");
  });
});

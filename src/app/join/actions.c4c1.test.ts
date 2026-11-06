import { describe, expect, it, vi } from "vitest";

const { findFirst, transaction } = vi.hoisted(() => ({ findFirst: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/auth", () => ({ CENTER_COOKIE: "nexo-center-id", requireSessionUser: vi.fn(async () => "user-a") }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: transaction, invitationCode: { findFirst } } }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set: vi.fn() })) }));

import { redeemInvitationAction } from "./actions";

describe("C4C1 invitation prevalidation", () => {
  it("rejects archived-center invitations using a generic error", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValueOnce([]), invitationCode: { findFirst }, centerMember: { findFirst: vi.fn() }, profile: { upsert: vi.fn() } };
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    findFirst.mockResolvedValue(null);
    const formData = new FormData();
    formData.set("code", "ABCD-1234");

    await expect(redeemInvitationAction({}, formData)).resolves.toEqual({ error: "El código no es válido, ya fue utilizado o venció." });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { codeHash: expect.any(String) }, select: { id: true, centerId: true } }));
  });
});

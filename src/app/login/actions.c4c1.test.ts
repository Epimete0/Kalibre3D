import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveActiveMembership, signInWithPassword, get, set, remove, redirect } = vi.hoisted(() => ({
  resolveActiveMembership: vi.fn(),
  signInWithPassword: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get, set, delete: remove })), headers: vi.fn(async () => ({ get: vi.fn() })) }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth", () => ({ CENTER_COOKIE: "nexo-center-id", resolveActiveMembership }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn(async () => ({ auth: { signInWithPassword } })) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth-errors", () => ({ mapSupabaseLoginError: vi.fn(() => "Credenciales inválidas.") }));

import { loginAction } from "./actions";

const formData = () => {
  const data = new FormData();
  data.set("email", "user@example.com");
  data.set("password", "password123");
  return data;
};

describe("C4C1 login center selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockReturnValue({ value: "invalid" });
    signInWithPassword.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    redirect.mockImplementation((path: string) => { throw new Error(`REDIRECT:${path}`); });
  });

  it("sets only a resolved active membership", async () => {
    resolveActiveMembership.mockResolvedValue({ centerId: "11111111-1111-4111-8111-111111111111", role: "OWNER", center: { name: "Activo" } });

    await expect(loginAction({}, formData())).rejects.toThrow("REDIRECT:/dashboard");

    expect(resolveActiveMembership).toHaveBeenCalledWith("user-a", "invalid");
    expect(set).toHaveBeenCalledWith("nexo-center-id", "11111111-1111-4111-8111-111111111111", expect.objectContaining({ httpOnly: true }));
    expect(remove).not.toHaveBeenCalled();
  });

  it("clears the cookie when no active membership exists", async () => {
    resolveActiveMembership.mockResolvedValue(undefined);

    await expect(loginAction({}, formData())).rejects.toThrow("REDIRECT:/dashboard");

    expect(remove).toHaveBeenCalledWith("nexo-center-id");
    expect(set).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireOperationalContext } = vi.hoisted(() => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
  },
  requireOperationalContext: vi.fn().mockResolvedValue({
    userId: "user-1",
    centerId: "center-1",
    role: "OWNER",
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireOperationalContext }));

import { resolveNewOrderOperation } from "./order-operation";

describe("resolveNewOrderOperation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("genera un nuevo operationId con redirect si el candidato es undefined o inválido", async () => {
    const res1 = await resolveNewOrderOperation(undefined, { newOperationId: () => "op-new-1" });
    expect(res1).toEqual({ kind: "NEW", operationId: "op-new-1", redirect: true });

    const res2 = await resolveNewOrderOperation("not-a-uuid", { newOperationId: () => "op-new-2" });
    expect(res2).toEqual({ kind: "NEW", operationId: "op-new-2", redirect: true });
  });

  it("retorna NEW sin redirect si el candidato es un UUID nuevo que no existe en el taller", async () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    prisma.order.findUnique.mockResolvedValueOnce(null);

    const res = await resolveNewOrderOperation(validUuid);
    expect(res).toEqual({ kind: "NEW", operationId: validUuid, redirect: false });
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: {
        centerId_operationId: {
          centerId: "center-1",
          operationId: validUuid,
        },
      },
      select: { id: true, createdByUserId: true },
    });
  });

  it("retorna EXISTING_OWN si el pedido ya existe y fue creado por el mismo usuario", async () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    prisma.order.findUnique.mockResolvedValueOnce({
      id: "order-123",
      createdByUserId: "user-1",
    });

    const res = await resolveNewOrderOperation(validUuid);
    expect(res).toEqual({ kind: "EXISTING_OWN", orderId: "order-123" });
  });

  it("retorna FOREIGN con un nuevo operationId si el pedido existe pero pertenece a otro usuario", async () => {
    const validUuid = "11111111-1111-4111-8111-111111111111";
    prisma.order.findUnique.mockResolvedValueOnce({
      id: "order-456",
      createdByUserId: "other-user",
    });

    const res = await resolveNewOrderOperation(validUuid, { newOperationId: () => "op-fresh" });
    expect(res).toEqual({ kind: "FOREIGN", operationId: "op-fresh" });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireOperationalContext, requireCatalogContext } = vi.hoisted(() => ({
  prisma: {
    customer: {
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    order: {
      count: vi.fn(),
    },
  },
  requireOperationalContext: vi.fn().mockResolvedValue({
    userId: "user-op",
    centerId: "center-a",
    role: "PROFESSIONAL",
    membership: { userId: "user-op", centerId: "center-a", role: "PROFESSIONAL" },
  }),
  requireCatalogContext: vi.fn().mockResolvedValue({
    userId: "user-admin",
    centerId: "center-a",
    role: "ADMIN",
    membership: { userId: "user-admin", centerId: "center-a", role: "ADMIN" },
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireOperationalContext, requireCatalogContext }));

import { createCustomer, deleteCustomer, setCustomerActive, updateCustomer } from "./customer-service";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("customer-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.customer.create.mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ id: VALID_UUID, ...(args.data as object) })
    );
    prisma.customer.updateMany.mockResolvedValue({ count: 1 });
    prisma.customer.deleteMany.mockResolvedValue({ count: 1 });
    prisma.order.count.mockResolvedValue(0);
  });

  describe("createCustomer", () => {
    it("crea un cliente con nombre, teléfono, instagram y notas", async () => {
      const result = await createCustomer(
        form({
          name: "  Carlos Santana  ",
          phone: " +56912345678 ",
          instagram: " @carlitos.3d ",
          notes: " Cliente recurrente ",
        })
      );

      expect(requireOperationalContext).toHaveBeenCalled();
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          centerId: "center-a",
          createdByUserId: "user-op",
          name: "Carlos Santana",
          phone: "+56912345678",
          instagram: "carlitos.3d",
          notes: "Cliente recurrente",
          active: true,
        },
      });
      expect(result.name).toBe("Carlos Santana");
      expect(result.instagram).toBe("carlitos.3d");
    });

    it("permite omitir teléfono, instagram y notas", async () => {
      await createCustomer(form({ name: "María Gómez" }));

      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: {
          centerId: "center-a",
          createdByUserId: "user-op",
          name: "María Gómez",
          phone: null,
          instagram: null,
          notes: null,
          active: true,
        },
      });
    });

    it("limpia arroba y espacios de instagram", async () => {
      await createCustomer(form({ name: "Ana", instagram: "@@@ana_prints  " }));
      expect(prisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          instagram: "ana_prints",
        }),
      });
    });

    it("rechaza nombre vacío", async () => {
      await expect(createCustomer(form({ name: "   " }))).rejects.toThrow(
        "El nombre del cliente es obligatorio."
      );
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it("rechaza nombre mayor a 100 caracteres", async () => {
      await expect(createCustomer(form({ name: "a".repeat(101) }))).rejects.toThrow(
        "El nombre no puede superar los 100 caracteres."
      );
    });
  });

  describe("updateCustomer", () => {
    it("actualiza un cliente existente", async () => {
      await updateCustomer(
        form({
          id: VALID_UUID,
          name: "Carlos S.",
          phone: "+56987654321",
          instagram: "@carlos.mod",
          notes: "Nueva dirección",
        })
      );

      expect(requireOperationalContext).toHaveBeenCalled();
      expect(prisma.customer.updateMany).toHaveBeenCalledWith({
        where: {
          id: VALID_UUID,
          centerId: "center-a",
        },
        data: {
          name: "Carlos S.",
          phone: "+56987654321",
          instagram: "carlos.mod",
          notes: "Nueva dirección",
        },
      });
    });

    it("falla si el cliente no existe en el taller", async () => {
      prisma.customer.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(updateCustomer(form({ id: VALID_UUID, name: "Carlos" }))).rejects.toThrow(
        "Cliente no encontrado."
      );
    });

    it("rechaza identificador inválido", async () => {
      await expect(updateCustomer(form({ id: "invalid-id", name: "Carlos" }))).rejects.toThrow(
        "Identificador de cliente no válido."
      );
    });
  });

  describe("setCustomerActive", () => {
    it("activa y desactiva el cliente", async () => {
      await setCustomerActive(VALID_UUID, false);
      expect(requireOperationalContext).toHaveBeenCalled();
      expect(prisma.customer.updateMany).toHaveBeenCalledWith({
        where: { id: VALID_UUID, centerId: "center-a" },
        data: { active: false },
      });
    });

    it("soporta recibir FormData", async () => {
      await setCustomerActive(form({ id: VALID_UUID, active: "true" }));
      expect(prisma.customer.updateMany).toHaveBeenCalledWith({
        where: { id: VALID_UUID, centerId: "center-a" },
        data: { active: true },
      });
    });

    it("falla si el cliente a cambiar estado no existe", async () => {
      prisma.customer.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(setCustomerActive(VALID_UUID, true)).rejects.toThrow("Cliente no encontrado.");
    });
  });

  describe("deleteCustomer", () => {
    it("elimina físicamente al cliente si no tiene pedidos registrados", async () => {
      prisma.order.count.mockResolvedValueOnce(0);
      await deleteCustomer(VALID_UUID);

      expect(requireCatalogContext).toHaveBeenCalled();
      expect(prisma.order.count).toHaveBeenCalledWith({
        where: { centerId: "center-a", customerId: VALID_UUID },
      });
      expect(prisma.customer.deleteMany).toHaveBeenCalledWith({
        where: { id: VALID_UUID, centerId: "center-a" },
      });
    });

    it("soporta recibir FormData", async () => {
      prisma.order.count.mockResolvedValueOnce(0);
      await deleteCustomer(form({ id: VALID_UUID }));
      expect(prisma.customer.deleteMany).toHaveBeenCalledWith({
        where: { id: VALID_UUID, centerId: "center-a" },
      });
    });

    it("prohíbe eliminar al cliente si ya tiene pedidos registrados", async () => {
      prisma.order.count.mockResolvedValueOnce(2);

      await expect(deleteCustomer(VALID_UUID)).rejects.toThrow(
        "No se puede eliminar el cliente porque ya tiene pedidos registrados. Puedes desactivarlo para ocultarlo."
      );
      expect(prisma.customer.deleteMany).not.toHaveBeenCalled();
    });

    it("falla si el cliente no existe al intentar eliminarlo", async () => {
      prisma.order.count.mockResolvedValueOnce(0);
      prisma.customer.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(deleteCustomer(VALID_UUID)).rejects.toThrow("Cliente no encontrado.");
    });
  });
});

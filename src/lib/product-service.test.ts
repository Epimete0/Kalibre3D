import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma, requireCatalogContext } = vi.hoisted(() => ({
  prisma: {
    product: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    orderItem: {
      count: vi.fn(),
    },
  },
  requireCatalogContext: vi.fn().mockResolvedValue({ userId: "user-a", centerId: "center-a", role: "OWNER" }),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ requireCatalogContext }));

import { createProduct, deleteProduct, setProductActive, updateProduct } from "./product-service";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("product-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.create.mockImplementation((args: { data: unknown }) => Promise.resolve({ id: "prod-1", ...(args.data as object) }));
    prisma.product.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.deleteMany.mockResolvedValue({ count: 1 });
    prisma.orderItem.count.mockResolvedValue(0);
  });

  describe("createProduct", () => {
    it("crea una pieza con precio normal y precio ML opcional", async () => {
      const result = await createProduct(form({ name: " Emblema Hilux ", salePrice: "8990", mlPrice: "10990" }));
      expect(requireCatalogContext).toHaveBeenCalled();
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          centerId: "center-a",
          name: "Emblema Hilux",
          salePrice: 8990,
          mlPrice: 10990,
          createdByUserId: "user-a",
        },
      });
      expect(result.name).toBe("Emblema Hilux");
      expect(result.salePrice).toBe(8990);
      expect(result.mlPrice).toBe(10990);
    });

    it("permite omitir el precio de Mercado Libre", async () => {
      await createProduct(form({ name: "Llavero", salePrice: "2500" }));
      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Llavero",
          salePrice: 2500,
          mlPrice: null,
        }),
      });
    });

    it("rechaza un nombre vacío o demasiado largo", async () => {
      await expect(createProduct(form({ name: "", salePrice: "1000" }))).rejects.toThrow("Escribe el nombre de la pieza.");
      await expect(createProduct(form({ name: "x".repeat(161), salePrice: "1000" }))).rejects.toThrow(/demasiado largo/);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it("rechaza precios negativos o no enteros", async () => {
      await expect(createProduct(form({ name: "Pieza", salePrice: "-500" }))).rejects.toThrow(/mayor o igual a 0/);
      await expect(createProduct(form({ name: "Pieza", salePrice: "100.5" }))).rejects.toThrow(/número entero/);
      await expect(createProduct(form({ name: "Pieza", salePrice: "1000", mlPrice: "-100" }))).rejects.toThrow(/mayor o igual a 0/);
    });

    it("rechaza crear una pieza si ya existe otra con el mismo nombre en el taller", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "prod-existing", name: "Emblema Hilux" });
      await expect(createProduct(form({ name: "emblema hilux", salePrice: "8990" }))).rejects.toThrow("Ya existe una pieza con ese nombre.");
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it("traduce el choque con el índice único de PostgreSQL si hay carrera", async () => {
      prisma.product.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["Product_centerId_name_key"] },
      });
      await expect(createProduct(form({ name: "Emblema", salePrice: "5000" }))).rejects.toThrow("Ya existe una pieza con ese nombre.");
    });
  });

  describe("updateProduct", () => {
    it("actualiza los datos de la pieza", async () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      await updateProduct(form({ id, name: "Emblema Pro", salePrice: "9990", mlPrice: "11990" }));
      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { id, centerId: "center-a" },
        data: {
          name: "Emblema Pro",
          salePrice: 9990,
          mlPrice: 11990,
        },
      });
    });

    it("rechaza si otro producto del mismo taller ya tiene ese nombre", async () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      prisma.product.findFirst.mockResolvedValue({ id: "prod-otro", name: "Emblema Pro" });
      await expect(updateProduct(form({ id, name: "Emblema Pro", salePrice: "9990" }))).rejects.toThrow("Ya existe una pieza con ese nombre.");
      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("setProductActive", () => {
    it("desactiva o reactiva la pieza filtrando por centerId", async () => {
      const id = "550e8400-e29b-41d4-a716-446655440000";
      await setProductActive(form({ id, active: "false" }));
      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { id, centerId: "center-a" },
        data: { active: false },
      });
    });
  });

  describe("deleteProduct", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";

    it("elimina físicamente la pieza si nunca ha tenido pedidos", async () => {
      prisma.orderItem.count.mockResolvedValue(0);
      await deleteProduct(form({ id }));
      expect(prisma.product.deleteMany).toHaveBeenCalledWith({
        where: { id, centerId: "center-a" },
      });
    });

    it("rechaza eliminar si ya tiene pedidos registrados y sugiere desactivar", async () => {
      prisma.orderItem.count.mockResolvedValue(2);
      await expect(deleteProduct(form({ id }))).rejects.toThrow(
        "No se puede eliminar la pieza porque ya tiene pedidos registrados. Puedes desactivarla para ocultarla."
      );
      expect(prisma.product.deleteMany).not.toHaveBeenCalled();
    });
  });
});

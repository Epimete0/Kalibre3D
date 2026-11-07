import { describe, expect, it } from "vitest";
import { isUniqueViolation, uniqueViolationMessage } from "./unique-violation";

// Forma real del error, capturada de Prisma 7 + driver adapter contra PostgreSQL local.
const real = (index: string) => ({ name: "PrismaClientKnownRequestError", code: "P2002", meta: { driverAdapterError: { cause: { originalCode: "23505", constraint: { index } } }, modelName: "Supplier" }, message: `Unique constraint failed on the constraint: \`${index}\`` });

describe("uniqueViolationMessage", () => {
  it("traduce cada índice de nombre normalizado a su mensaje claro", () => {
    expect(uniqueViolationMessage(real("Product_centerId_name_key"))).toBe("Ya existe una pieza con ese nombre.");
    expect(uniqueViolationMessage(real("Supplier_centerId_normalized_name_key"))).toBe("Ya existe un proveedor con ese nombre.");
    expect(uniqueViolationMessage(real("Category_centerId_normalized_name_key"))).toBe("Ya existe una categoría con ese nombre.");
    expect(uniqueViolationMessage(real("Subcategory_categoryId_normalized_name_key"))).toBe("Ya existe un tipo con ese nombre.");
    expect(uniqueViolationMessage(real("Brand_supplierId_normalized_name_key"))).toBe("Ya existe una marca con ese nombre.");
  });

  it("también entiende `meta.target` (texto o lista) y el texto del mensaje", () => {
    expect(uniqueViolationMessage({ code: "P2002", meta: { target: "Supplier_centerId_normalized_name_key" } })).toBe("Ya existe un proveedor con ese nombre.");
    expect(uniqueViolationMessage({ code: "P2002", meta: { target: ["Brand_supplierId_normalized_name_key"] } })).toBe("Ya existe una marca con ese nombre.");
    expect(uniqueViolationMessage({ code: "P2002", message: "Unique constraint failed on the constraint: `Category_centerId_normalized_name_key`" })).toBe("Ya existe una categoría con ese nombre.");
  });

  it("ignora errores que no son de nombre repetido", () => {
    expect(uniqueViolationMessage(real("Client_phone_key"))).toBeNull();
    expect(uniqueViolationMessage({ code: "P2025" })).toBeNull();
    expect(uniqueViolationMessage({ code: "P2002" })).toBeNull();
    expect(uniqueViolationMessage(new Error("boom"))).toBeNull();
    expect(uniqueViolationMessage(null)).toBeNull();
    expect(uniqueViolationMessage("texto")).toBeNull();
  });

  it("detecta violaciones de índice único con isUniqueViolation", () => {
    expect(isUniqueViolation(real("MoneyTransaction_centerId_operationId_key"), "MoneyTransaction_centerId_operationId_key")).toBe(true);
    expect(isUniqueViolation(real("MoneyTransaction_centerId_operationId_key"), "Other_key")).toBe(false);
    expect(isUniqueViolation(real("MoneyTransaction_centerId_operationId_key"))).toBe(true);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
  });
});

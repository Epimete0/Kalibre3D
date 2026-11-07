import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MATERIALS,
  MATERIAL_LABEL,
  PRODUCT_MOVEMENT_KINDS,
  PRODUCT_MOVEMENT_LABEL,
  SPOOL_MOVEMENT_KINDS,
  SPOOL_MOVEMENT_LABEL,
} from "./catalog-presentation";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES, INCOME_CATEGORIES, METHOD_LABEL, PAYMENT_METHODS } from "./money-presentation";
import { CHANNEL_LABEL, KIND_LABEL, STATUS_ACTION_LABEL, STATUS_LABEL } from "./order-presentation";
import { ORDER_CHANNELS, ORDER_KINDS, ORDER_STATUSES } from "./order-status";

describe("etiquetas y valores cerrados", () => {
  it("cada valor tiene su etiqueta en español", () => {
    for (const status of ORDER_STATUSES) { expect(STATUS_LABEL[status]).toBeTruthy(); expect(STATUS_ACTION_LABEL[status]).toBeTruthy(); }
    for (const channel of ORDER_CHANNELS) expect(CHANNEL_LABEL[channel]).toBeTruthy();
    for (const kind of ORDER_KINDS) expect(KIND_LABEL[kind]).toBeTruthy();
    for (const category of [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES]) expect(CATEGORY_LABEL[category]).toBeTruthy();
    for (const method of PAYMENT_METHODS) expect(METHOD_LABEL[method]).toBeTruthy();
    for (const material of MATERIALS) expect(MATERIAL_LABEL[material]).toBeTruthy();
    for (const movKind of PRODUCT_MOVEMENT_KINDS) expect(PRODUCT_MOVEMENT_LABEL[movKind]).toBeTruthy();
    for (const spoolKind of SPOOL_MOVEMENT_KINDS) expect(SPOOL_MOVEMENT_LABEL[spoolKind]).toBeTruthy();
  });

  it("los valores de TypeScript coinciden con los CHECK de la migración", async () => {
    const sqlPhase1 = await readFile(path.join(process.cwd(), "prisma/migrations-postgres/20261108000000_phase1_orders_money/migration.sql"), "utf8");
    const sqlPhase2 = await readFile(path.join(process.cwd(), "prisma/migrations-postgres/20261109000000_phase2_catalog_spools_stock/migration.sql"), "utf8");
    const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(",");
    expect(sqlPhase1).toContain(`"status" IN (${list(ORDER_STATUSES)})`);
    expect(sqlPhase1).toContain(`"channel" IN (${list(ORDER_CHANNELS)})`);
    expect(sqlPhase1).toContain(`"kind" IN (${list(ORDER_KINDS)})`);
    expect(sqlPhase1).toContain(`"category" IN (${list(INCOME_CATEGORIES)})`);
    expect(sqlPhase1).toContain(`"category" IN (${list(EXPENSE_CATEGORIES)})`);
    expect(sqlPhase1).toContain(`"method" IN (${list(PAYMENT_METHODS)})`);
    expect(sqlPhase2).toContain(`"material" IN (${list(MATERIALS)})`);
  });
});

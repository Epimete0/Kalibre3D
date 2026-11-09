import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const NAME = "20261111000000_order_item_unit_cost";
const migration = lf(read("prisma", "migrations-postgres", NAME, "migration.sql"));
const apply = lf(read("scripts", "production", "20261111-apply-order-item-unit-cost.sql"));

describe("paquete de producción 2026-11-11 (costo unitario por venta)", () => {
  it("contiene el SQL textual de la migración y registra su checksum SHA-256 LF", () => {
    const checksum = sha(migration);
    expect(apply).toContain(migration.trimEnd());
    expect(apply).toContain(`'${checksum}', now(), '${NAME}'`);
    expect(apply).toContain(`SHA-256 (LF) de migration.sql: ${checksum}`);
  });

  it("exige la migración anterior, aplica en una transacción y verifica sin borrar datos", () => {
    expect(apply).toContain("'20261110000000_guided_setup_costs'");
    expect(apply.match(/^BEGIN ISOLATION LEVEL REPEATABLE READ;/gm)).toHaveLength(1);
    expect(apply.match(/^COMMIT;/gm)).toHaveLength(1);
    expect(apply.indexOf("$verify$")).toBeGreaterThan(apply.indexOf('INSERT INTO public."_prisma_migrations"'));
    expect(apply).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE)\b/im);
  });

  it("la migración solo agrega una columna opcional y un CHECK", () => {
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|POLICY|GRANT|REVOKE|NOT NULL)\b/i);
    expect(migration).toContain('ADD COLUMN "unitCost" INTEGER;');
  });
});

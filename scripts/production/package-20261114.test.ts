import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const NAME = "20261114000000_machine_wear_and_failures";
const migration = lf(read("prisma", "migrations-postgres", NAME, "migration.sql"));
const apply = lf(read("scripts", "production", "20261114-apply-machine-wear-and-failures.sql"));

describe("paquete de producción 2026-11-14 (desgaste y margen de fallos)", () => {
  it("contiene el SQL textual de la migración y registra su checksum SHA-256 LF", () => {
    const checksum = sha(migration);
    expect(apply).toContain(migration.trimEnd());
    expect(apply).toContain(`'${checksum}', now(), '${NAME}'`);
    expect(apply).toContain(`SHA-256 (LF) de migration.sql: ${checksum}`);
  });

  it("exige las migraciones anteriores, aplica en una transacción y verifica sin borrar datos", () => {
    expect(apply).toContain("'20261110000000_guided_setup_costs'");
    expect(apply).toContain("'20261111000000_order_item_unit_cost'");
    expect(apply.match(/^BEGIN ISOLATION LEVEL REPEATABLE READ;/gm)).toHaveLength(1);
    expect(apply.match(/^COMMIT;/gm)).toHaveLength(1);
    expect(apply.indexOf("$verify$")).toBeGreaterThan(apply.indexOf('INSERT INTO public."_prisma_migrations"'));
    expect(apply).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE)\b/im);
  });

  it("la migración solo agrega columnas aditivas con DEFAULT 0 y un CHECK", () => {
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|POLICY|GRANT|REVOKE)\b/i);
    expect(migration).toContain('ADD COLUMN "machineReplacementCost" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('ADD COLUMN "machineWearCostPerHour" INTEGER NOT NULL DEFAULT 0');
    expect(migration).toContain('ADD COLUMN "failurePercent" DECIMAL(5, 2) NOT NULL DEFAULT 0');
  });
});

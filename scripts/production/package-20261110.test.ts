import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const NAME = "20261110000000_guided_setup_costs";
const migration = lf(read("prisma", "migrations-postgres", NAME, "migration.sql"));
const apply = lf(read("scripts", "production", "20261110-apply-guided-setup-costs.sql"));

describe("paquete de producción 2026-11-10 (inicio guiado: costos opcionales)", () => {
  it("contiene el SQL textual de la migración y registra su checksum SHA-256 LF", () => {
    const checksum = sha(migration);
    expect(apply).toContain(migration.trimEnd());
    expect(apply).toContain(`'${checksum}', now(), '${NAME}'`);
    expect(apply).toContain(`SHA-256 (LF) de migration.sql: ${checksum}`);
  });

  it("aplica en una sola transacción, con preflight y verificación, sin borrar datos", () => {
    expect(apply.match(/^BEGIN ISOLATION LEVEL REPEATABLE READ;/gm)).toHaveLength(1);
    expect(apply.match(/^COMMIT;/gm)).toHaveLength(1);
    expect(apply.indexOf("$preflight$")).toBeLessThan(apply.indexOf("ALTER TABLE"));
    expect(apply.indexOf("$verify$")).toBeGreaterThan(apply.indexOf("INSERT INTO public.\"_prisma_migrations\""));
    expect(apply).toContain("ya está registrada");
    expect(apply).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE|UPDATE)\b/im);
  });

  it("la migración solo agrega columnas con valor por defecto y un CHECK", () => {
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE|UPDATE|POLICY|GRANT|REVOKE)\b/i);
    expect(migration.match(/ADD COLUMN "\w+" \w+(\(\d+,\d+\))? NOT NULL DEFAULT/g)).toHaveLength(5);
  });
});

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts), "utf8");
const lf = (text: string) => text.replace(/\r\n/g, "\n");
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

const manifest = JSON.parse(read("scripts", "production", "20261108-manifest.json")) as {
  generatedFor: string[];
  migrations: { name: string; sha256LF: string }[];
  packages: { name: string; checksum: string }[];
};
const preflight = lf(read("scripts", "production", "20261108-00-preflight-initial-schema.sql"));
const dryRun = lf(read("scripts", "production", "20261108-01-dry-run-initial-schema.sql"));
const apply = lf(read("scripts", "production", "20261108-02-apply-initial-schema.sql"));
const verify = lf(read("scripts", "production", "20261108-03-verify-initial-schema.sql"));

describe("paquete de producción inicial 2026-11-08 (Kalibre / saas3d)", () => {
  it("incluye el SQL textual y el checksum SHA-256 LF de las 4 migraciones reales", () => {
    expect(manifest.migrations).toHaveLength(4);
    for (const migration of manifest.migrations) {
      const sql = lf(read("prisma", "migrations-postgres", migration.name, "migration.sql"));
      expect(sha(sql)).toBe(migration.sha256LF);
      expect(apply).toContain(sql.trimEnd());
      expect(dryRun).toContain(sql.trimEnd());
      expect(apply).toContain(`'${migration.sha256LF}'`);
      expect(verify).toContain(`'${migration.sha256LF}'`);
    }
  });

  it("los paquetes en disco coinciden con el manifiesto", () => {
    for (const pkg of manifest.packages) {
      expect(sha(lf(read("scripts", "production", pkg.name)))).toBe(pkg.checksum);
    }
  });

  it("aplica en una sola transacción REPEATABLE READ, crea _prisma_migrations si falta y registra las 4 migraciones", () => {
    expect(apply.match(/^BEGIN ISOLATION LEVEL REPEATABLE READ;/gm)).toHaveLength(1);
    expect(apply.match(/^COMMIT;/gm)).toHaveLength(1);
    expect(apply).toContain('CREATE TABLE IF NOT EXISTS public."_prisma_migrations"');
    expect(apply.match(/INSERT INTO public\."_prisma_migrations"/g)).toHaveLength(4);
    expect(apply).not.toMatch(/^\s*(DROP TABLE|TRUNCATE)\b/im);
  });

  it("el dry-run y la verificación terminan en ROLLBACK y el preflight es de solo lectura", () => {
    expect(dryRun).toMatch(/^ROLLBACK;/m);
    expect(dryRun).not.toMatch(/^COMMIT;/m);
    expect(verify).toMatch(/^BEGIN READ ONLY;/m);
    expect(preflight).toMatch(/^BEGIN READ ONLY;/m);
    expect(preflight).not.toMatch(/INSERT INTO|CREATE |ALTER |DROP /);
  });

  it("verifica las 16 tablas, RLS, ACL SERVER_ONLY, app_private y los 8 triggers críticos", () => {
    for (const script of [dryRun, apply, verify]) {
      expect(script).toContain("CenterMember_last_owner_guard");
      expect(script).toContain("Order_delete_guard");
      expect(script).toContain("OrderEvent_immutable");
      expect(script).toContain("MoneyTransaction_guard");
      expect(script).toContain("Product_delete_guard");
      expect(script).toContain("ProductMovement_immutable");
      expect(script).toContain("Spool_delete_guard");
      expect(script).toContain("SpoolMovement_immutable");
      expect(script).toContain("app_private.is_center_member(uuid)");
      expect(script).toContain("app_private.has_center_role(uuid,text[])");
    }
  });
});

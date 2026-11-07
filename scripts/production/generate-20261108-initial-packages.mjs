// Genera los paquetes SQL de producción para el despliegue inicial de Kalibre (saas3d)
// leyendo las 4 migraciones reales de prisma/migrations-postgres/.
// Uso: node scripts/production/generate-20261108-initial-packages.mjs
// Solo escribe archivos. No se conecta a ninguna base de datos.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const migrationsDir = path.join(root, "prisma", "migrations-postgres");
const outDir = path.join(root, "scripts", "production");

mkdirSync(outDir, { recursive: true });

export const BATCH = [
  "20261107000000_core_multitenant",
  "20261108000000_phase1_orders_money",
  "20261108000100_fix_money_void_check",
  "20261109000000_phase2_catalog_spools_stock",
];

const norm = (text) => text.replace(/\r\n/g, "\n");
const sha = (text) => createHash("sha256").update(text, "utf8").digest("hex");

const migrations = BATCH.map((name) => {
  const sql = norm(readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"));
  if (sql.includes("$saas3d_batch$")) {
    throw new Error(`La migración ${name} usa el delimitador reservado.`);
  }
  return { name, sql, checksum: sha(sql) };
});

const list = (items) => items.map((item) => `    '${item}'`).join(",\n");
const header = (title, extra) => `-- ${title}
-- Kalibre (saas3d) · Lote fundacional 2026-11-08: ${BATCH.length} migraciones (${BATCH[0]} … ${BATCH[BATCH.length - 1]}).
-- GENERADO por scripts/production/generate-20261108-initial-packages.mjs. No editar a mano: regenerar.
${extra}
`;

const guards = `SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL idle_in_transaction_session_timeout = '120s';`;

const allAppTables = [
  "Profile",
  "Center",
  "CenterMember",
  "InvitationCode",
  "OnboardingDismissal",
  "CenterSettings",
  "Product",
  "ProductMovement",
  "Spool",
  "SpoolMovement",
  "Customer",
  "Order",
  "OrderItem",
  "OrderEvent",
  "MoneyTransaction",
];

const serverOnlyTables = [
  "_prisma_migrations",
  "CenterSettings",
  "Product",
  "ProductMovement",
  "Spool",
  "SpoolMovement",
  "Customer",
  "Order",
  "OrderItem",
  "OrderEvent",
  "MoneyTransaction",
];

const preflightBlock = `DO $preflight$
DECLARE
  batch text[] := ARRAY[
${list(BATCH)}
  ];
  app_tables text[] := ARRAY[
${list(allAppTables)}
  ];
  unfinished text[];
  already text[];
  existing_tables text[] := '{}';
  tbl text;
  bypass boolean;
  blocked integer;
BEGIN
  SELECT rolbypassrls OR rolsuper INTO bypass FROM pg_roles WHERE rolname = current_user;
  IF bypass IS NOT TRUE THEN
    RAISE EXCEPTION 'PREFLIGHT: la conexión debe ser administrativa (BYPASSRLS o superusuario). Usuario actual: %.', current_user;
  END IF;

  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    SELECT coalesce(array_agg(migration_name ORDER BY migration_name), '{}') INTO unfinished
      FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
    IF cardinality(unfinished) > 0 THEN
      RAISE EXCEPTION 'PREFLIGHT: hay migraciones sin terminar en el historial: %.', unfinished;
    END IF;

    SELECT coalesce(array_agg(migration_name ORDER BY migration_name), '{}') INTO already
      FROM public."_prisma_migrations" WHERE migration_name = ANY (batch);
    IF cardinality(already) > 0 THEN
      RAISE EXCEPTION 'PREFLIGHT: el lote ya está registrado (total o parcialmente): %. No continuar sin revisar.', already;
    END IF;
  END IF;

  FOREACH tbl IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      existing_tables := existing_tables || tbl;
    END IF;
  END LOOP;
  IF cardinality(existing_tables) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: ya existen tablas de la aplicación en public: %. Revisar manualmente.', existing_tables;
  END IF;

  SELECT count(*) INTO blocked FROM pg_stat_activity
   WHERE datname = current_database() AND pid <> pg_backend_pid()
     AND (wait_event_type = 'Lock' OR state = 'idle in transaction');
  IF blocked > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: % sesión(es) bloqueada(s) o idle in transaction. Reintentar cuando se liberen.', blocked;
  END IF;

  RAISE NOTICE 'PREFLIGHT OK: base limpia, privilegios administrativos verificados y sin bloqueos.';
END
$preflight$;`;

const ensurePrismaMigrationsTable = `-- Tabla de historial de Prisma (necesaria en una base nueva de Supabase antes de la migración 0.4)
CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);`;

const structural = `DO $structure$
DECLARE
  problems text[] := '{}';
  all_tables text[] := ARRAY[
    '_prisma_migrations',
${list(allAppTables)}
  ];
  server_only text[] := ARRAY[
${list(serverOnlyTables)}
  ];
  direct_rls text[] := ARRAY['Profile', 'Center', 'CenterMember', 'InvitationCode', 'OnboardingDismissal'];
  triggers text[] := ARRAY[
    'CenterMember_last_owner_guard',
    'Order_delete_guard',
    'OrderEvent_immutable',
    'MoneyTransaction_guard',
    'Product_delete_guard',
    'ProductMovement_immutable',
    'Spool_delete_guard',
    'SpoolMovement_immutable'
  ];
  tbl text;
  trig text;
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      problems := problems || ('tabla ausente: ' || tbl);
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = to_regclass(format('public.%I', tbl)) AND relrowsecurity
    ) THEN
      problems := problems || ('RLS inactivo en: ' || tbl);
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY server_only LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      IF has_table_privilege('anon', format('public.%I', tbl), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
         OR has_table_privilege('authenticated', format('public.%I', tbl), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        problems := problems || ('ACL abierta en SERVER_ONLY: ' || tbl);
      END IF;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY direct_rls LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      IF has_table_privilege('anon', format('public.%I', tbl), 'SELECT, INSERT, UPDATE, DELETE') THEN
        problems := problems || ('anon con privilegios en: ' || tbl);
      END IF;
    END IF;
  END LOOP;

  IF to_regnamespace('app_private') IS NULL THEN
    problems := problems || 'esquema app_private ausente';
  ELSIF has_schema_privilege('anon', 'app_private', 'USAGE')
     OR has_schema_privilege('authenticated', 'app_private', 'USAGE') THEN
    problems := problems || 'esquema app_private expuesto a la API';
  END IF;

  IF to_regprocedure('app_private.is_center_member(uuid)') IS NULL THEN
    problems := problems || 'función app_private.is_center_member ausente';
  END IF;
  IF to_regprocedure('app_private.has_center_role(uuid,text[])') IS NULL THEN
    problems := problems || 'función app_private.has_center_role ausente';
  END IF;

  FOREACH trig IN ARRAY triggers LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trig AND NOT tgisinternal) THEN
      problems := problems || ('trigger ausente: ' || trig);
    END IF;
  END LOOP;

  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT: faltan o difieren objetos esperados: %.', problems;
  END IF;

  RAISE NOTICE 'POSTFLIGHT OK: 16 tablas, RLS, ACL SERVER_ONLY, app_private y triggers verificados.';
END
$structure$;`;

const registration = (m) => `INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '${m.checksum}', now(), '${m.name}', NULL, now(), 1);`;

const body = (withRegistration) =>
  migrations
    .map(
      (m) => `-- ============================================================
-- ${m.name}
-- SHA-256 (LF): ${m.checksum}
-- ============================================================
${m.sql.trimEnd()}
${withRegistration ? `\n${registration(m)}` : ""}`,
    )
    .join("\n\n");

const write = (name, content) => {
  const normalized = content.replace(/\r\n/g, "\n");
  writeFileSync(path.join(outDir, name), normalized, "utf8");
  return { name, checksum: sha(normalized) };
};

const files = [];

files.push(
  write(
    "20261108-00-preflight-initial-schema.sql",
    `${header("PREFLIGHT de solo lectura", "-- No modifica nada. Ejecutar primero en Supabase SQL Editor o psql (DIRECT_URL) y revisar que termine con PREFLIGHT OK.")}
BEGIN READ ONLY;
${guards}
${preflightBlock}
SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS tiene_tabla_prisma_migrations;
ROLLBACK;
`,
  ),
);

files.push(
  write(
    "20261108-01-dry-run-initial-schema.sql",
    `${header("DRY-RUN con ROLLBACK", "-- Aplica las 4 migraciones fundacionales dentro de una transacción REPEATABLE READ, verifica toda la estructura y hace ROLLBACK. Nada queda persistido.")}
BEGIN ISOLATION LEVEL REPEATABLE READ;
${guards}
${preflightBlock}

${ensurePrismaMigrationsTable}

${body(true)}

${structural}
ROLLBACK;

-- Verificación fuera de la transacción: nada debe haber quedado creado.
SELECT
  to_regclass('public."Center"') IS NULL AS center_ausente,
  to_regclass('public."Order"') IS NULL AS order_ausente,
  to_regclass('public."Spool"') IS NULL AS spool_ausente;
`,
  ),
);

files.push(
  write(
    "20261108-02-apply-initial-schema.sql",
    `${header("APLICACIÓN en producción (Supabase)", "-- REQUIERE AUTORIZACIÓN EXPLÍCITA. Ejecutar solo después de que 00-preflight y 01-dry-run hayan terminado OK.\n-- Una sola transacción: si cualquier paso falla, no queda nada aplicado ni registrado.")}
BEGIN ISOLATION LEVEL REPEATABLE READ;
${guards}
${preflightBlock}

${ensurePrismaMigrationsTable}

${body(true)}

${structural}
COMMIT;

SELECT migration_name, finished_at IS NOT NULL AS terminada
  FROM public."_prisma_migrations"
 WHERE migration_name IN (${BATCH.map((n) => `'${n}'`).join(", ")})
 ORDER BY migration_name;
`,
  ),
);

files.push(
  write(
    "20261108-03-verify-initial-schema.sql",
    `${header("VERIFICACIÓN posterior (solo lectura)", "-- Ejecutar después de 02-apply. Debe terminar con POSTFLIGHT OK y sin excepciones.")}
BEGIN READ ONLY;
DO $verify$
DECLARE
  batch text[] := ARRAY[
${list(BATCH)}
  ];
  expected_checksums text[] := ARRAY[
${migrations.map((m) => `    '${m.checksum}'`).join(",\n")}
  ];
  i integer;
  found text;
BEGIN
  FOR i IN 1..cardinality(batch) LOOP
    SELECT checksum INTO found FROM public."_prisma_migrations"
     WHERE migration_name = batch[i] AND finished_at IS NOT NULL AND rolled_back_at IS NULL;
    IF found IS NULL THEN RAISE EXCEPTION 'VERIFY: migración % sin registrar o sin terminar.', batch[i]; END IF;
    IF found <> expected_checksums[i] THEN RAISE EXCEPTION 'VERIFY: checksum distinto para %.', batch[i]; END IF;
  END LOOP;
END
$verify$;
${structural}
SELECT migration_name, checksum, finished_at
  FROM public."_prisma_migrations"
 ORDER BY migration_name;
ROLLBACK;
`,
  ),
);

const manifest = {
  generatedFor: BATCH,
  migrations: migrations.map(({ name, checksum }) => ({ name, sha256LF: checksum })),
  packages: files,
};
writeFileSync(path.join(outDir, "20261108-manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify(manifest, null, 2));

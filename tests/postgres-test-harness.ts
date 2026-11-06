import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Client } from "pg";

const resetPublicSchemaSql = `
  DROP SCHEMA IF EXISTS app_private CASCADE;
  DROP SCHEMA IF EXISTS public CASCADE;
  CREATE SCHEMA public;
  GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
`;

const prismaMigrationsTableSql = `
  CREATE TABLE "_prisma_migrations" (
    id TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    finished_at TIMESTAMPTZ,
    migration_name TEXT NOT NULL,
    logs TEXT,
    rolled_back_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  );
`;

export async function applyPostgresMigrations(db: Client, options: { recordMigrationHistory?: boolean; beforeMigration?: (migrationName: string) => Promise<void>; throughMigration?: string } = {}) {
  const root = path.join(process.cwd(), "prisma", "migrations-postgres");
  const folders = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  await db.query(resetPublicSchemaSql);
  await db.query(prismaMigrationsTableSql);

  for (const folder of folders) {
    await options.beforeMigration?.(folder);
    const migration = await readFile(path.join(root, folder, "migration.sql"), "utf8");
    await db.query(migration);
    if (options.recordMigrationHistory) {
      await db.query(
        "INSERT INTO \"_prisma_migrations\" (id, checksum, finished_at, migration_name, started_at, applied_steps_count) VALUES ($1, $2, now(), $3, now(), 1)",
        [`fixture-${folder}`, createHash("sha256").update(migration).digest("hex"), folder],
      );
    }
    if (folder === options.throughMigration) return folders;
  }

  return folders;
}

export async function cleanupPostgresFixture(db: Client, authUserIds: readonly string[]) {
  // A rejected statement inside a test transaction leaves the shared client aborted.
  await db.query("ROLLBACK");
  await db.query(resetPublicSchemaSql);
  if (authUserIds.length > 0) {
    await db.query("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [authUserIds]);
  }
}

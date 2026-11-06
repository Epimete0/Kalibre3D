import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

const run = process.env.RUN_S3_INTEGRATION === "1";
const describeS3 = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL!;
const url = process.env.SUPABASE_TEST_URL!;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;
const db = run ? new Client({ connectionString: databaseUrl }) : null;
const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"] as const;

type TableState = {
  owner: string;
  rls_enabled: boolean;
  force_rls: boolean;
  policies: number;
  anon: Record<(typeof privileges)[number], boolean>;
  authenticated: Record<(typeof privileges)[number], boolean>;
  service_role: Record<(typeof privileges)[number], boolean>;
  postgres: Record<(typeof privileges)[number], boolean>;
  publicPrivileges: boolean;
};

function requireEnvironment() {
  for (const value of [databaseUrl, url, publishableKey]) if (!value) throw new Error("S3 requiere SUPABASE_TEST_* con Supabase local.");
  if (!/^postgresql:\/\/(postgres:postgres@)?(127\.0\.0\.1|localhost)/.test(databaseUrl)) throw new Error("S3 requiere PostgreSQL local.");
}

async function tableState(): Promise<TableState> {
  const table = "public.\"_prisma_migrations\"";
  const state = (await db!.query(`
    SELECT c.relowner::regrole::text AS owner, c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS force_rls, count(p.polname)::int AS policies,
      EXISTS (SELECT 1 FROM aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
        WHERE acl.grantee = 0) AS "publicPrivileges"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policy p ON p.polrelid = c.oid
    WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations'
    GROUP BY c.oid
  `)).rows[0] as Omit<TableState, "anon" | "authenticated" | "service_role" | "postgres">;
  const rolePrivileges = async (role: string) => {
    const entries: [string, boolean][] = [];
    for (const privilege of privileges) {
      const result = await db!.query("SELECT has_table_privilege($1, $2, $3) AS allowed", [role, table, privilege]);
      entries.push([privilege, result.rows[0].allowed]);
    }
    return Object.fromEntries(entries) as Record<(typeof privileges)[number], boolean>;
  };
  return { ...state, anon: await rolePrivileges("anon"), authenticated: await rolePrivileges("authenticated"), service_role: await rolePrivileges("service_role"), postgres: await rolePrivileges("postgres") };
}

describeS3("S3A ACL de _prisma_migrations", () => {
  let before: TableState | undefined;
  let preStatus: number | undefined;

  beforeAll(async () => { requireEnvironment(); await db!.connect(); });
  beforeEach(async () => {
    before = undefined;
    preStatus = undefined;
    await applyPostgresMigrations(db!, {
      beforeMigration: async (migrationName) => {
        // En saas3d el endurecimiento de _prisma_migrations vive en la migración fundacional.
        if (migrationName !== "20261107000000_core_multitenant") return;
        await db!.query('GRANT ALL PRIVILEGES ON TABLE public."_prisma_migrations" TO anon, authenticated, service_role');
        before = await tableState();
        // El harness recrea el schema public: PostgREST necesita recargar su caché para ver la tabla.
        await db!.query("NOTIFY pgrst, 'reload schema'");
        for (let attempt = 0; attempt < 50; attempt += 1) {
          preStatus = (await fetch(`${url}/rest/v1/_prisma_migrations?select=migration_name&limit=0`, { headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}` } })).status;
          if (preStatus === 200) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      },
    });
  });
  afterAll(async () => { await cleanupPostgresFixture(db!, []); await db!.end(); });

  it("revoca ACL públicos sin alterar la semántica interna de Prisma", async () => {
    // Antes de la migración fundacional la tabla tiene los ACL por defecto de Supabase y aún no tiene RLS.
    expect(before).toMatchObject({ owner: "postgres", rls_enabled: false, force_rls: false, policies: 0 });
    expect(preStatus).toBe(200);
    for (const role of [before!.anon, before!.authenticated, before!.service_role, before!.postgres]) for (const privilege of privileges) expect(role[privilege]).toBe(true);

    const after = await tableState();
    expect(after).toMatchObject({ owner: "postgres", rls_enabled: true, force_rls: false, policies: 0, publicPrivileges: false });
    for (const role of [after.anon, after.authenticated]) for (const privilege of privileges) expect(role[privilege]).toBe(false);
    for (const role of [after.service_role, after.postgres]) for (const privilege of privileges) expect(role[privilege]).toBe(true);

    const response = await fetch(`${url}/rest/v1/_prisma_migrations?select=migration_name&limit=0`, { headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}` } });
    const body = await response.json() as { code?: string; message?: string };
    expect(response.status).not.toBe(200);
    expect(body.code).toBe("42501");
    expect(body.message).toMatch(/permission denied.*_prisma_migrations/i);
  });
});

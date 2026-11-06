// Pruebas RLS reales del núcleo multi-tenant de saas3d (Supabase local `saas3d-test`).
// Portadas desde Kurova (solo lectura) y recortadas a las tablas del núcleo:
// Profile, Center, CenterMember, InvitationCode, OnboardingDismissal y _prisma_migrations.
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const run = process.env.RUN_RLS_INTEGRATION === "1";
const describeRls = run ? describe : describe.skip;
const url = process.env.SUPABASE_TEST_URL!;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL!;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;
const password = "Integration-test-password-123";
const admin = run ? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const db = run ? new Client({ connectionString: databaseUrl }) : null;
const users: string[] = [];
const ids = { centerA: randomUUID(), centerB: randomUUID() };
const coreTables = ["Profile", "Center", "CenterMember", "InvitationCode", "OnboardingDismissal"] as const;
let ownerA: SupabaseClient, adminA: SupabaseClient, professionalA: SupabaseClient, viewerA: SupabaseClient, memberB: SupabaseClient, outsider: SupabaseClient, concurrentUser: SupabaseClient;
let ownerAId = "", adminAId = "", professionalAId = "", viewerAId = "", memberBId = "", outsiderId = "";

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString();

function requireTestEnvironment() {
  for (const value of [url, databaseUrl, publishableKey, serviceRoleKey]) if (!value) throw new Error("Ejecuta con npm run test:rls y Supabase local iniciado, o define SUPABASE_TEST_*.");
  if (!/^(http:\/\/(127\.0\.0\.1|localhost)|https:\/\/.*test)/.test(url) && process.env.SUPABASE_TEST_ALLOW_REMOTE !== "true") throw new Error("Las pruebas RLS rechazan destinos remotos salvo SUPABASE_TEST_ALLOW_REMOTE=true.");
}

const resetSql = "DROP SCHEMA IF EXISTS app_private CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;";

async function applyMigrations() {
  const root = path.join(process.cwd(), "prisma", "migrations-postgres");
  const directories = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  await db!.query(`${resetSql} CREATE TABLE "_prisma_migrations" (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, finished_at TIMESTAMPTZ, migration_name TEXT NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_steps_count INTEGER NOT NULL DEFAULT 0);`);
  for (const directory of directories) await db!.query(await readFile(path.join(root, directory, "migration.sql"), "utf8"));
}

async function createUser(label: string) {
  const { data, error } = await admin!.auth.admin.createUser({ email: `${label}-${randomUUID()}@rls.test`, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("No se creó el usuario de prueba");
  users.push(data.user.id);
  const client = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: loginError } = await client.auth.signInWithPassword({ email: data.user.email!, password });
  if (loginError) throw loginError;
  return { id: data.user.id, client };
}

async function insertFixtures() {
  await db!.query("INSERT INTO \"Center\" (id, name, \"updatedAt\") VALUES ($1, 'Taller A', now()), ($2, 'Taller B', now())", [ids.centerA, ids.centerB]);
  await db!.query("INSERT INTO \"Profile\" (id, \"displayName\", \"updatedAt\") VALUES ($1, 'Owner A', now()), ($2, 'Admin A', now()), ($3, 'Ayudante A', now()), ($4, 'Viewer A', now()), ($5, 'Member B', now())", [ownerAId, adminAId, professionalAId, viewerAId, memberBId]);
  await db!.query("INSERT INTO \"CenterMember\" (\"centerId\", \"userId\", role, \"updatedAt\") VALUES ($1,$2,'OWNER',now()),($1,$3,'ADMIN',now()),($1,$4,'PROFESSIONAL',now()),($1,$5,'VIEWER',now()),($6,$7,'OWNER',now())", [ids.centerA, ownerAId, adminAId, professionalAId, viewerAId, ids.centerB, memberBId]);
}

async function claimInvitation(codeHash: string, userId: string) {
  const connection = new Client({ connectionString: databaseUrl });
  await connection.connect();
  try {
    await connection.query("BEGIN");
    const invitation = await connection.query("SELECT id, \"centerId\", role FROM \"InvitationCode\" WHERE \"codeHash\" = $1 AND \"revokedAt\" IS NULL AND \"redeemedAt\" IS NULL AND \"expiresAt\" > now()", [codeHash]);
    if (!invitation.rowCount) { await connection.query("ROLLBACK"); return false; }
    await connection.query("INSERT INTO \"Profile\" (id, \"updatedAt\") VALUES ($1, now()) ON CONFLICT (id) DO NOTHING", [userId]);
    const claimed = await connection.query("UPDATE \"InvitationCode\" SET \"redeemedAt\" = now(), \"redeemedByUserId\" = $1 WHERE id = $2 AND \"redeemedAt\" IS NULL AND \"revokedAt\" IS NULL AND \"expiresAt\" > now()", [userId, invitation.rows[0].id]);
    if (!claimed.rowCount) { await connection.query("ROLLBACK"); return false; }
    await connection.query("INSERT INTO \"CenterMember\" (\"centerId\", \"userId\", role, \"updatedAt\") VALUES ($1,$2,$3,now())", [invitation.rows[0].centerId, userId, invitation.rows[0].role]);
    await connection.query("COMMIT");
    return true;
  } finally { await connection.end(); }
}

describeRls("RLS real del núcleo multi-tenant", () => {
  beforeAll(async () => { requireTestEnvironment(); await db!.connect(); });
  beforeEach(async () => {
    await applyMigrations();
    ({ id: ownerAId, client: ownerA } = await createUser("owner-a"));
    ({ id: adminAId, client: adminA } = await createUser("admin-a"));
    ({ id: professionalAId, client: professionalA } = await createUser("professional-a"));
    ({ id: viewerAId, client: viewerA } = await createUser("viewer-a"));
    ({ id: memberBId, client: memberB } = await createUser("member-b"));
    ({ id: outsiderId, client: outsider } = await createUser("outsider"));
    ({ client: concurrentUser } = await createUser("concurrent"));
    await insertFixtures();
  });

  afterEach(async () => {
    await db!.query("ROLLBACK").catch(() => undefined);
    for (const id of users.splice(0)) await admin!.auth.admin.deleteUser(id);
    await db!.query(resetSql);
  });
  afterAll(async () => { await db!.end(); });

  it("aísla los talleres: una sesión del Taller A no ve nada del Taller B y viceversa", async () => {
    expect((await ownerA.from("Center").select("id")).data).toEqual([{ id: ids.centerA }]);
    expect((await memberB.from("Center").select("id")).data).toEqual([{ id: ids.centerB }]);
    expect((await ownerA.from("CenterMember").select("userId").eq("centerId", ids.centerB)).data).toEqual([]);
    expect((await memberB.from("CenterMember").select("userId").eq("centerId", ids.centerA)).data).toEqual([]);
    expect((await ownerA.from("CenterMember").select("userId").eq("centerId", ids.centerA)).data).toHaveLength(4);
    await db!.query("INSERT INTO \"InvitationCode\" (\"codeHash\", role, \"expiresAt\", \"createdByUserId\", \"centerId\") VALUES ('b-invite','VIEWER',now() + interval '1 day',$1,$2)", [memberBId, ids.centerB]);
    expect((await ownerA.from("InvitationCode").select("id").eq("centerId", ids.centerB)).data).toEqual([]);
  });

  it("no muestra talleres ni miembros a usuarios sin membresía ni a anon", async () => {
    expect((await outsider.from("Center").select("id")).data).toEqual([]);
    expect((await outsider.from("CenterMember").select("userId")).data).toEqual([]);
    expect((await outsider.from("InvitationCode").select("id")).data).toEqual([]);
    const anonymous = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const table of coreTables) {
      const result = await anonymous.from(table).select("*").limit(1);
      expect(result.data).toBeNull();
      expect(result.error).not.toBeNull();
    }
  });

  it("Profile solo es visible y editable por su dueño, y no se borra por la API", async () => {
    expect((await ownerA.from("Profile").select("id")).data).toEqual([{ id: ownerAId }]);
    expect((await ownerA.from("Profile").select("id").eq("id", adminAId)).data).toEqual([]);
    expect((await ownerA.from("Profile").update({ displayName: "Intruso" }).eq("id", adminAId).select("id")).data).toEqual([]);
    const own = await ownerA.from("Profile").update({ displayName: "Dueño A" }).eq("id", ownerAId).select("displayName");
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ displayName: "Dueño A" }]);
    // Hay GRANT DELETE (paridad con Kurova) pero ninguna política DELETE: no se borra ninguna fila.
    const deleted = await ownerA.from("Profile").delete().eq("id", ownerAId).select("id");
    expect(deleted.data ?? []).toEqual([]);
    expect((await db!.query("SELECT id FROM \"Profile\" WHERE id = $1", [ownerAId])).rows).toHaveLength(1);
  });

  it("nadie cambia roles ni membresías por la API, ni siquiera ADMIN sobre el OWNER", async () => {
    const professionalChange = await professionalA.from("CenterMember").update({ role: "VIEWER" }).eq("centerId", ids.centerA).eq("userId", ownerAId).select();
    expect(professionalChange.data).toBeNull();
    expect(professionalChange.error).not.toBeNull();
    const adminChange = await adminA.from("CenterMember").update({ role: "VIEWER" }).eq("centerId", ids.centerA).eq("userId", ownerAId).select();
    expect(adminChange.data).toBeNull();
    expect(adminChange.error).not.toBeNull();
    const selfJoin = await outsider.from("CenterMember").insert({ centerId: ids.centerA, userId: outsiderId, role: "OWNER", updatedAt: new Date().toISOString() });
    expect(selfJoin.error).not.toBeNull();
  });

  it("solo OWNER y ADMIN administran invitaciones; vencidas no se pueden reclamar", async () => {
    const create = (client: SupabaseClient, hash: string, userId: string, expiresAt: string) => client.from("InvitationCode").insert({ codeHash: hash, role: "PROFESSIONAL", expiresAt, createdByUserId: userId, centerId: ids.centerA });
    expect((await create(ownerA, "owner-invite", ownerAId, tomorrow())).error).toBeNull();
    expect((await create(adminA, "admin-invite", adminAId, tomorrow())).error).toBeNull();
    expect((await create(professionalA, "professional-invite", professionalAId, tomorrow())).error).not.toBeNull();
    expect((await create(viewerA, "viewer-invite", viewerAId, tomorrow())).error).not.toBeNull();
    expect((await create(memberB, "cross-invite", memberBId, tomorrow())).error).not.toBeNull();
    expect((await professionalA.from("InvitationCode").select("id")).data).toEqual([]);
    expect((await viewerA.from("InvitationCode").select("id")).data).toEqual([]);
    expect((await ownerA.from("InvitationCode").select("id")).data).toHaveLength(2);
    expect((await create(ownerA, "expired-invite", ownerAId, new Date(Date.now() - 86_400_000).toISOString())).error).toBeNull();
    expect(await claimInvitation("expired-invite", outsiderId)).toBe(false);
  });

  it("rechaza DELETE directo de invitaciones y preferencias de onboarding", async () => {
    const invitation = await ownerA.from("InvitationCode").insert({ codeHash: "delete-protected-invite", role: "VIEWER", expiresAt: tomorrow(), createdByUserId: ownerAId, centerId: ids.centerA }).select("id").single();
    expect(invitation.error).toBeNull();
    const dismissal = await ownerA.from("OnboardingDismissal").insert({ userId: ownerAId, centerId: ids.centerA }).select("userId").single();
    expect(dismissal.error).toBeNull();
    // saas3d no concede DELETE en estas tablas (más estricto que la copia local de Kurova).
    expect((await ownerA.from("InvitationCode").delete().eq("id", invitation.data!.id).select("id")).error).not.toBeNull();
    expect((await ownerA.from("OnboardingDismissal").delete().eq("userId", ownerAId).eq("centerId", ids.centerA).select("userId")).error).not.toBeNull();
  });

  it("OnboardingDismissal solo se registra para el propio usuario en un taller propio", async () => {
    expect((await ownerA.from("OnboardingDismissal").insert({ userId: adminAId, centerId: ids.centerA })).error).not.toBeNull();
    expect((await ownerA.from("OnboardingDismissal").insert({ userId: ownerAId, centerId: ids.centerB })).error).not.toBeNull();
    expect((await adminA.from("OnboardingDismissal").insert({ userId: adminAId, centerId: ids.centerA })).error).toBeNull();
    expect((await ownerA.from("OnboardingDismissal").select("userId")).data).toEqual([]);
  });

  it("canjea una invitación una sola vez y conserva el rol fijado bajo concurrencia", async () => {
    await ownerA.from("InvitationCode").insert({ codeHash: "single-use", role: "VIEWER", expiresAt: tomorrow(), createdByUserId: ownerAId, centerId: ids.centerA });
    expect(await claimInvitation("single-use", outsiderId)).toBe(true);
    expect(await claimInvitation("single-use", outsiderId)).toBe(false);
    const role = await db!.query("SELECT role FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [ids.centerA, outsiderId]);
    expect(role.rows[0].role).toBe("VIEWER");
    await ownerA.from("InvitationCode").insert({ codeHash: "concurrent-use", role: "PROFESSIONAL", expiresAt: tomorrow(), createdByUserId: ownerAId, centerId: ids.centerA });
    const [firstSession, secondSession] = await Promise.all([memberB.auth.getUser(), concurrentUser.auth.getUser()]);
    const results = await Promise.all([claimInvitation("concurrent-use", firstSession.data.user!.id), claimInvitation("concurrent-use", secondSession.data.user!.id)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("mantiene _prisma_migrations inaccesible por la API pública", async () => {
    for (const client of [createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } }), ownerA]) {
      const { data, error } = await client.from("_prisma_migrations").select("migration_name");
      expect(data).toBeNull();
      expect(error).not.toBeNull();
    }
  });

  it("solo OWNER puede archivar su taller; archivado deja de ser visible y se conserva", async () => {
    const adminArchive = await adminA.from("Center").update({ active: false }).eq("id", ids.centerA).select("active");
    expect(adminArchive.error).toBeNull();
    expect(adminArchive.data).toEqual([]);
    const crossArchive = await memberB.from("Center").update({ active: false }).eq("id", ids.centerA).select("active");
    expect(crossArchive.data).toEqual([]);
    const rename = await ownerA.from("Center").update({ name: "Otro nombre" }).eq("id", ids.centerA).select("name");
    expect(rename.data ?? []).toEqual([]);
    const ownerArchive = await ownerA.from("Center").update({ active: false }).eq("id", ids.centerA).select("active");
    expect(ownerArchive.error).toBeNull();
    expect(ownerArchive.data).toEqual([{ active: false }]);
    expect((await ownerA.from("Center").select("id").eq("id", ids.centerA)).data).toEqual([]);
    expect((await db!.query("SELECT active, name FROM \"Center\" WHERE id = $1", [ids.centerA])).rows[0]).toEqual({ active: false, name: "Taller A" });
  });

  it("un taller activo nunca queda sin un OWNER activo", async () => {
    await expect(db!.query("UPDATE \"CenterMember\" SET role = 'ADMIN' WHERE \"centerId\" = $1 AND \"userId\" = $2", [ids.centerA, ownerAId])).rejects.toMatchObject({ code: "23514", message: "El taller debe conservar al menos un dueño activo." });
    await expect(db!.query("UPDATE \"CenterMember\" SET active = false WHERE \"centerId\" = $1 AND \"userId\" = $2", [ids.centerA, ownerAId])).rejects.toMatchObject({ code: "23514" });
    await expect(db!.query("DELETE FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [ids.centerA, ownerAId])).rejects.toMatchObject({ code: "23514" });
    await db!.query("BEGIN");
    await db!.query("UPDATE \"CenterMember\" SET role = 'OWNER' WHERE \"centerId\" = $1 AND \"userId\" = $2", [ids.centerA, adminAId]);
    await db!.query("UPDATE \"CenterMember\" SET role = 'ADMIN' WHERE \"centerId\" = $1 AND \"userId\" = $2", [ids.centerA, ownerAId]);
    await db!.query("COMMIT");
    const owners = await db!.query("SELECT \"userId\" FROM \"CenterMember\" WHERE \"centerId\" = $1 AND role = 'OWNER' AND active", [ids.centerA]);
    expect(owners.rows).toEqual([{ userId: adminAId }]);
    await db!.query("UPDATE \"Center\" SET active = false WHERE id = $1", [ids.centerB]);
    await db!.query("UPDATE \"CenterMember\" SET active = false WHERE \"centerId\" = $1", [ids.centerB]);
  });

  it("deja RLS activo y sin políticas en _prisma_migrations, y activo en todo el núcleo", async () => {
    const flags = await db!.query("SELECT c.relname AS table_name, c.relrowsecurity AS rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'");
    expect(flags.rows.every((row) => row.rls)).toBe(true);
    expect(flags.rows.map((row) => row.table_name).sort()).toEqual([...coreTables, "_prisma_migrations"].sort());
    const policies = await db!.query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'public' AND tablename = '_prisma_migrations'");
    expect(policies.rows[0].count).toBe(0);
  });
});

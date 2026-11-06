// S1: los helpers SECURITY DEFINER viven en app_private, no son invocables por la API
// y las políticas del núcleo que los usan siguen funcionando. Portado desde Kurova
// (solo lectura) y recortado a las tablas del núcleo de saas3d.
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

const run = process.env.RUN_S1_INTEGRATION === "1";
const describeS1 = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL!;
const url = process.env.SUPABASE_TEST_URL!;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;
const db = run ? new Client({ connectionString: databaseUrl }) : null;
const admin = run ? createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const users: string[] = [];

function requireEnvironment() {
  for (const value of [databaseUrl, url, publishableKey, serviceRoleKey]) if (!value) throw new Error("S1 requiere SUPABASE_TEST_* con Supabase local.");
  if (!/^postgresql:\/\/(postgres:postgres@)?(127\.0\.0\.1|localhost)/.test(databaseUrl)) throw new Error("S1 requiere PostgreSQL local.");
}

async function createUser(label: string) {
  const email = `${label}-${randomUUID()}@s1.test`;
  const password = "S1-integration-password-123";
  const result = await admin!.auth.admin.createUser({ email, password, email_confirm: true });
  if (result.error || !result.data.user) throw result.error ?? new Error("No se creó usuario S1.");
  users.push(result.data.user.id);
  const client = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error("No se inició sesión S1.");
  return { id: result.data.user.id, client, token: signedIn.data.session.access_token };
}

async function rpc(name: string, token: string) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: publishableKey, authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ target_center_id: randomUUID() }) });
  return { status: response.status, body: await response.json() as { code?: string } };
}

describeS1("S1 helpers privados del núcleo", () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let administrator: Awaited<ReturnType<typeof createUser>>;
  let professional: Awaited<ReturnType<typeof createUser>>;
  let viewer: Awaited<ReturnType<typeof createUser>>;
  let inactiveMember: Awaited<ReturnType<typeof createUser>>;
  let inactiveCenter: Awaited<ReturnType<typeof createUser>>;
  const ids = { center: randomUUID(), other: randomUUID(), inactive: randomUUID(), invitation: randomUUID() };

  beforeAll(async () => { requireEnvironment(); await db!.connect(); });
  beforeEach(async () => {
    await applyPostgresMigrations(db!);
    owner = await createUser("owner"); administrator = await createUser("admin"); professional = await createUser("professional"); viewer = await createUser("viewer"); inactiveMember = await createUser("inactive-member"); inactiveCenter = await createUser("inactive-center");
    await db!.query("INSERT INTO \"Center\" (id,name,active,\"updatedAt\") VALUES ($1,'A',true,now()),($2,'B',true,now()),($3,'I',false,now())", [ids.center, ids.other, ids.inactive]);
    for (const user of [owner, administrator, professional, viewer, inactiveMember, inactiveCenter]) await db!.query("INSERT INTO \"Profile\" (id,\"updatedAt\") VALUES ($1,now())", [user.id]);
    await db!.query("INSERT INTO \"CenterMember\" (\"centerId\",\"userId\",role,active,\"updatedAt\") VALUES ($1,$2,'OWNER',true,now()),($1,$3,'ADMIN',true,now()),($1,$4,'PROFESSIONAL',true,now()),($1,$5,'VIEWER',true,now()),($1,$6,'VIEWER',false,now()),($7,$8,'VIEWER',true,now())", [ids.center, owner.id, administrator.id, professional.id, viewer.id, inactiveMember.id, ids.inactive, inactiveCenter.id]);
    await db!.query("INSERT INTO \"InvitationCode\" (id,\"codeHash\",role,\"expiresAt\",\"createdByUserId\",\"centerId\") VALUES ($1,'hash','VIEWER',now()+interval '1 day',$2,$3)", [ids.invitation, owner.id, ids.center]);
  });
  afterEach(async () => { await db!.query("DROP SCHEMA IF EXISTS app_private CASCADE"); await cleanupPostgresFixture(db!, users.splice(0)); });
  afterAll(async () => { await db!.end(); });

  it("deja los helpers en app_private, sin EXECUTE para PUBLIC ni anon, y sin USAGE del schema", async () => {
    const functions = await db!.query("SELECT n.nspname schema,p.proname,p.prosecdef,EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') public_execute,has_function_privilege('anon',p.oid,'EXECUTE') anon_execute FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname IN ('has_center_role','is_center_member') ORDER BY p.proname");
    expect(functions.rows.map((row) => [row.schema, row.proname, row.prosecdef])).toEqual([["app_private", "has_center_role", true], ["app_private", "is_center_member", true]]);
    expect(functions.rows.every((row) => !row.public_execute && !row.anon_execute)).toBe(true);
    expect((await db!.query("SELECT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='app_private' AND a.grantee=0 AND a.privilege_type='USAGE') public_usage,has_schema_privilege('anon','app_private','USAGE') anon_usage,has_schema_privilege('authenticated','app_private','USAGE') authenticated_usage,has_schema_privilege('service_role','app_private','USAGE') service_role_usage")).rows[0]).toEqual({ public_usage: false, anon_usage: false, authenticated_usage: false, service_role_usage: false });
    const dependencies = (await db!.query("SELECT p.polname,f.proname FROM pg_depend d JOIN pg_policy p ON d.classid='pg_policy'::regclass AND d.objid=p.oid JOIN pg_proc f ON f.oid=d.refobjid WHERE f.proname IN ('has_center_role','is_center_member') ORDER BY 1,2")).rows;
    expect(dependencies.length).toBeGreaterThan(0);
  });

  it("las políticas que usan los helpers funcionan para miembros activos de talleres activos", async () => {
    const readCenter = (client: SupabaseClient, id: string) => client.from("Center").select("id").eq("id", id);
    for (const user of [owner, administrator, professional, viewer]) expect((await readCenter(user.client, ids.center)).data).toEqual([{ id: ids.center }]);
    expect((await readCenter(owner.client, ids.other)).data).toEqual([]);
    expect((await readCenter(inactiveMember.client, ids.center)).data).toEqual([]);
    expect((await readCenter(inactiveCenter.client, ids.inactive)).data).toEqual([]);
    for (const user of [owner, administrator]) expect((await user.client.from("InvitationCode").select("id").eq("id", ids.invitation)).data).toEqual([{ id: ids.invitation }]);
    for (const user of [professional, viewer, inactiveMember]) expect((await user.client.from("InvitationCode").select("id").eq("id", ids.invitation)).data).toEqual([]);
    const anon = await createClient(url, publishableKey).from("Center").select("id").eq("id", ids.center);
    expect(anon.error || anon.data?.length === 0).toBeTruthy();
  });

  it("los helpers no son invocables directamente ni por RPC", async () => {
    await db!.query("BEGIN");
    await expect(db!.query("SET LOCAL ROLE authenticated").then(() => db!.query("SELECT app_private.is_center_member($1)", [ids.center]))).rejects.toThrow("permission denied for schema app_private");
    await db!.query("ROLLBACK");
    for (const name of ["has_center_role", "is_center_member"]) { const result = await rpc(name, owner.token); expect(result.status).toBe(404); expect(result.body.code).toBe("PGRST202"); }
    const profile = await fetch(`${url}/rest/v1/Center?select=id&limit=0`, { headers: { apikey: publishableKey, authorization: `Bearer ${publishableKey}`, "accept-profile": "app_private" } });
    expect(profile.status).toBe(406);
  });
});

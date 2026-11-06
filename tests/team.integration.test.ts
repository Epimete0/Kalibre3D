import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createInvitation, hashInvitationCode, listInvitations, normalizeInvitationCode, revokeInvitation, type __InvitationTestDeps } from "@/lib/invitation-admin-service";
import { redeemInvitationWithDb } from "@/lib/invitation-service-core";
import { changeMemberRole, listTeam, setMemberActive, type __TeamTestDeps } from "@/lib/member-service";
import type { TeamRole } from "@/lib/team-rules";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

/**
 * Equipo e invitaciones contra PostgreSQL REAL.
 *
 * Intercalación (dos dueños se bajan de rol entre sí):
 *  1. A (dueño 1) baja a el dueño 2: abre su transacción, bloquea a las dueños y se detiene ahí (gancho de prueba).
 *  2. B (dueño 2) intenta bajar a el dueño 1: pide el mismo bloqueo y queda esperando (se observa en pg_stat_activity).
 *  3. A confirma. B obtiene el bloqueo, ve que ya no queda otra dueño y se rechaza. Queda exactamente UNA dueño.
 *  Sin el bloqueo, B no espera y ambas se bajan: el taller se quedaría sin dueño (el trigger de base de datos lo frenaría
 *  recién al confirmar, con un error técnico y no el mensaje claro).
 */

const run = process.env.RUN_TRANSACTION_INTEGRATION === "1";
const suite = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL;

let db: Client;
let monitor: Client;
let centerId: string;
let otherCenterId: string;
let owner1: string; let owner2: string; let admin: string; let pro: string; let viewer: string; let stranger: string;
let authUserIds: string[] = [];
const prismaClients: PrismaClient[] = [];

function localOnly() {
  if (!databaseUrl) throw new Error("Las pruebas de equipo requieren PostgreSQL local protegido.");
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(databaseUrl).hostname)) throw new Error("Las pruebas de equipo requieren PostgreSQL local protegido.");
}

function client(applicationName: string) {
  const url = new URL(databaseUrl!);
  url.searchParams.set("application_name", applicationName);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  prismaClients.push(prisma);
  return prisma;
}
const as = (userId: string, role: TeamRole, applicationName = "t", afterLocked?: () => Promise<void>): __TeamTestDeps => ({ prisma: client(applicationName), auth: { centerId, userId, role }, afterLocked });
const inviteAs = (userId: string, role: TeamRole): __InvitationTestDeps => ({ prisma: client("inv"), auth: { centerId, userId, role } });
const member = async (userId: string) => (await db.query("SELECT role, active FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, userId])).rows[0];
const owners = async () => Number((await db.query("SELECT count(*) FROM \"CenterMember\" WHERE \"centerId\" = $1 AND role = 'OWNER' AND active", [centerId])).rows[0].count);

async function waitForMemberLockWait(applicationName: string) {
  const deadline = Date.now() + 7_500;
  while (Date.now() < deadline) {
    const { rows } = await monitor.query<{ waitEventType: string | null; query: string }>("SELECT wait_event_type AS \"waitEventType\", query FROM pg_stat_activity WHERE application_name = $1 AND state = 'active'", [applicationName]);
    if (rows.some((row) => row.waitEventType === "Lock" && row.query.includes("\"CenterMember\""))) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`La transacción ${applicationName} no se observó esperando el bloqueo de las dueños.`);
}

suite("Equipo e invitaciones contra PostgreSQL local", () => {
  beforeAll(async () => {
    localOnly();
    db = new Client({ connectionString: databaseUrl });
    monitor = new Client({ connectionString: databaseUrl });
    await Promise.all([db.connect(), monitor.connect()]);
  });

  beforeEach(async () => {
    await applyPostgresMigrations(db);
    [centerId, otherCenterId, owner1, owner2, admin, pro, viewer, stranger] = Array.from({ length: 8 }, randomUUID);
    authUserIds = [owner1, owner2, admin, pro, viewer, stranger];
    for (const id of authUserIds) {
      await db.query("INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')", [id, `${id}@team.test`]);
    }
    await db.query("INSERT INTO \"Profile\" (id,\"displayName\",\"updatedAt\") SELECT id, 'P-' || substr(id::text,1,4), now() FROM auth.users WHERE id = ANY($1::uuid[])", [authUserIds]);
    await db.query("INSERT INTO \"Center\" (id,name,\"timeZone\",\"updatedAt\") VALUES ($1,'Equipo','America/Santiago',now()),($2,'Otro','America/Santiago',now())", [centerId, otherCenterId]);
    await db.query("INSERT INTO \"CenterMember\" (\"centerId\",\"userId\",role,\"updatedAt\") VALUES ($1,$2,'OWNER',now()),($1,$3,'OWNER',now()),($1,$4,'ADMIN',now()),($1,$5,'PROFESSIONAL',now()),($1,$6,'VIEWER',now()),($7,$8,'OWNER',now())", [centerId, owner1, owner2, admin, pro, viewer, otherCenterId, stranger]);
  });

  afterEach(async () => {
    await Promise.allSettled(prismaClients.splice(0).map((c) => c.$disconnect()));
    await cleanupPostgresFixture(db, authUserIds);
    authUserIds = [];
  });

  afterAll(async () => { await Promise.all([db.end(), monitor.end()]); });

  // ── Base de datos: el taller siempre conserva un dueño ─────────────
  it("la base de datos no deja al taller sin dueño activo (rol, desactivación ni borrado)", async () => {
    await db.query("UPDATE \"CenterMember\" SET role = 'ADMIN' WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, owner2]);
    await expect(db.query("UPDATE \"CenterMember\" SET role = 'VIEWER' WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, owner1])).rejects.toMatchObject({ code: "23514", message: expect.stringContaining("al menos un dueño") });
    await expect(db.query("UPDATE \"CenterMember\" SET active = false WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, owner1])).rejects.toMatchObject({ code: "23514" });
    await expect(db.query("DELETE FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, owner1])).rejects.toMatchObject({ code: "23514" });
    expect(await owners()).toBe(1);
  });

  it("dos cambios en una misma transacción que dejan a otra dueño se permiten; archivar el taller también", async () => {
    await db.query("BEGIN");
    await db.query("UPDATE \"CenterMember\" SET role = 'ADMIN' WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, owner1]);
    await db.query("COMMIT");
    expect(await owners()).toBe(1);
    await db.query("BEGIN");
    await db.query("UPDATE \"Center\" SET active = false WHERE id = $1", [centerId]);
    await db.query("UPDATE \"CenterMember\" SET active = false WHERE \"centerId\" = $1", [centerId]);
    await db.query("COMMIT");
    expect(await owners()).toBe(0);
  });

  // ── Cambiar el rol ───────────────────────────────────────────────────────
  it("el dueño cambia el rol de ayudantes, lectores y administradores", async () => {
    await changeMemberRole(pro, "VIEWER", as(owner1, "OWNER"));
    expect((await member(pro)).role).toBe("VIEWER");
    await changeMemberRole(viewer, "ADMIN", as(owner1, "OWNER"));
    expect((await member(viewer)).role).toBe("ADMIN");
    await changeMemberRole(admin, "PROFESSIONAL", as(owner1, "OWNER"));
    expect((await member(admin)).role).toBe("PROFESSIONAL");
  });

  it("el administrador solo mueve a ayudantes y lectores entre sí, y no toca a dueños ni a otros administradores", async () => {
    await changeMemberRole(pro, "VIEWER", as(admin, "ADMIN"));
    expect((await member(pro)).role).toBe("VIEWER");
    await expect(changeMemberRole(viewer, "ADMIN", as(admin, "ADMIN"))).rejects.toThrow("Solo un dueño puede nombrar administradores.");
    await expect(changeMemberRole(owner1, "VIEWER", as(admin, "ADMIN"))).rejects.toThrow(/Solo un dueño/);
    await expect(changeMemberRole(admin, "VIEWER", as(admin, "ADMIN"))).rejects.toThrow(/Solo un dueño/);
    expect((await member(owner1)).role).toBe("OWNER");
  });

  it("nadie asigna OWNER, y una persona de otro taller o desconocida no existe", async () => {
    await expect(changeMemberRole(pro, "OWNER", as(owner1, "OWNER"))).rejects.toThrow("El rol elegido no es válido.");
    await expect(changeMemberRole(stranger, "VIEWER", as(owner1, "OWNER"))).rejects.toThrow("La persona no pertenece a este taller.");
    await expect(changeMemberRole(randomUUID(), "VIEWER", as(owner1, "OWNER"))).rejects.toThrow("La persona no pertenece a este taller.");
    await expect(changeMemberRole("no-es-un-id", "VIEWER", as(owner1, "OWNER"))).rejects.toThrow("La persona no pertenece a este taller.");
    expect((await db.query("SELECT role FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [otherCenterId, stranger])).rows[0]).toEqual({ role: "OWNER" });
  });

  it("un dueño puede dejar de serlo solo si queda otra", async () => {
    await changeMemberRole(owner2, "ADMIN", as(owner1, "OWNER"));
    expect(await owners()).toBe(1);
    await expect(changeMemberRole(owner1, "ADMIN", as(owner1, "OWNER"))).rejects.toThrow("El taller debe conservar al menos un dueño activo.");
    expect(await owners()).toBe(1);
  });

  // ── Desactivar y reactivar ───────────────────────────────────────────────
  it("desactivar no borra nada y la persona se puede reactivar", async () => {
    const result = await setMemberActive(pro, false, as(admin, "ADMIN"));
    expect(result).toMatchObject({ active: false });
    expect(await member(pro)).toMatchObject({ active: false, role: "PROFESSIONAL" });
    await setMemberActive(pro, true, as(admin, "ADMIN"));
    expect(await member(pro)).toMatchObject({ active: true });
  });

  it("reglas de desactivación: no a sí mismo, no a el último dueño, no lo que el administrador no puede tocar", async () => {
    await expect(setMemberActive(owner1, false, as(owner1, "OWNER"))).rejects.toThrow("No puedes desactivarte a ti misma.");
    await expect(setMemberActive(owner1, false, as(admin, "ADMIN"))).rejects.toThrow(/Solo un dueño/);
    await setMemberActive(owner2, false, as(owner1, "OWNER"));
    await expect(setMemberActive(owner1, false, as(owner2, "OWNER"))).rejects.toThrow();
    expect(await owners()).toBe(1);
  });

  it("una persona desactivada no puede volver a unirse con un código", async () => {
    await setMemberActive(viewer, false, as(owner1, "OWNER"));
    const { code } = await createInvitation("VIEWER", inviteAs(owner1, "OWNER"));
    await expect(redeemInvitationWithDb({ db: client("redeem"), userId: viewer, codeHash: hashInvitationCode(code) })).rejects.toThrow("El código no es válido, ya fue utilizado o venció.");
    expect((await member(viewer)).active).toBe(false);
  });

  it("la lista del equipo trae a todas las personas del taller y nunca las de otro", async () => {
    const team = await listTeam(as(pro, "PROFESSIONAL"));
    expect(team.members).toHaveLength(5);
    expect(team.members.map((m) => m.userId)).not.toContain(stranger);
    expect(team.members.find((m) => m.userId === owner1)).toMatchObject({ role: "OWNER", active: true });
  });

  // ── Concurrencia ─────────────────────────────────────────────────────────
  it("dos dueños se bajan de rol a la vez: B espera, se rechaza y queda UNA dueño", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const hasLock = new Promise<void>((resolve) => { locked = resolve; });

    const a = changeMemberRole(owner2, "ADMIN", as(owner1, "OWNER", "own-a", async () => { locked(); await held; }));
    await hasLock;
    const b = changeMemberRole(owner1, "ADMIN", as(owner2, "OWNER", "own-b")).then(() => "bajó" as const, (error: Error) => error.message);
    await waitForMemberLockWait("own-b");
    release();
    await a;

    expect(await b).toBe("El taller debe conservar al menos un dueño activo.");
    expect(await owners()).toBe(1);
    expect((await member(owner1)).role).toBe("OWNER");
    expect((await member(owner2)).role).toBe("ADMIN");
  });

  // ── Invitaciones ─────────────────────────────────────────────────────────
  it("crear una invitación guarda solo la huella, vence a los 7 días y el código se puede canjear con o sin guiones", async () => {
    const created = await createInvitation("PROFESSIONAL", inviteAs(owner1, "OWNER"));
    expect(created.code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    const row = (await db.query("SELECT \"codeHash\", role, \"expiresAt\" FROM \"InvitationCode\" WHERE \"centerId\" = $1", [centerId])).rows[0];
    expect(row.codeHash).toBe(hashInvitationCode(created.code));
    expect(row.codeHash).not.toContain(created.code.replace(/-/g, ""));
    expect(row.role).toBe("PROFESSIONAL");
    const days = (new Date(row.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    const newcomer = randomUUID();
    authUserIds.push(newcomer);
    await db.query("INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')", [newcomer, `${newcomer}@team.test`]);
    const typed = created.code.replace(/-/g, "").toLowerCase();
    expect(normalizeInvitationCode(typed)).toBe(created.code);
    await redeemInvitationWithDb({ db: client("redeem"), userId: newcomer, codeHash: hashInvitationCode(typed) });
    expect(await db.query("SELECT role FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, newcomer]).then((r) => r.rows[0])).toEqual({ role: "PROFESSIONAL" });
    const second = randomUUID();
    authUserIds.push(second);
    await db.query("INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')", [second, `${second}@team.test`]);
    await expect(redeemInvitationWithDb({ db: client("redeem2"), userId: second, codeHash: hashInvitationCode(created.code) })).rejects.toThrow("El código no es válido, ya fue utilizado o venció.");
  });

  it("solo OWNER y ADMIN invitan; el administrador no invita administradores; el rol debe ser válido", async () => {
    await expect(createInvitation("ADMIN", inviteAs(admin, "ADMIN"))).rejects.toThrow("Un administrador solo puede invitar ayudantes o personas de consulta.");
    await expect(createInvitation("VIEWER", inviteAs(pro, "PROFESSIONAL"))).rejects.toThrow();
    await expect(createInvitation("OWNER", inviteAs(owner1, "OWNER"))).rejects.toThrow("El rol elegido no es válido.");
    await expect(createInvitation("VIEWER", inviteAs(admin, "ADMIN"))).resolves.toBeDefined();
    await expect(createInvitation("ADMIN", inviteAs(owner1, "OWNER"))).resolves.toBeDefined();
  });

  it("revocar impide canjear; no se revoca lo ya canjeado ni lo de otro taller; la lista muestra el estado", async () => {
    const { code } = await createInvitation("VIEWER", inviteAs(owner1, "OWNER"));
    const [listed] = await listInvitations(inviteAs(owner1, "OWNER"));
    expect(listed).toMatchObject({ role: "VIEWER", status: "ACTIVE" });
    await revokeInvitation(listed.id, inviteAs(admin, "ADMIN"));
    expect((await listInvitations(inviteAs(owner1, "OWNER")))[0].status).toBe("REVOKED");
    const newcomer = randomUUID();
    authUserIds.push(newcomer);
    await db.query("INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')", [newcomer, `${newcomer}@team.test`]);
    await expect(redeemInvitationWithDb({ db: client("redeem"), userId: newcomer, codeHash: hashInvitationCode(code) })).rejects.toThrow("El código no es válido, ya fue utilizado o venció.");
    await expect(revokeInvitation(listed.id, inviteAs(owner1, "OWNER"))).rejects.toThrow("La invitación no existe o ya no se puede revocar.");
    const foreign = (await db.query("INSERT INTO \"InvitationCode\" (\"codeHash\",role,\"expiresAt\",\"createdByUserId\",\"centerId\") VALUES ('x','VIEWER',now() + interval '1 day',$1,$2) RETURNING id", [stranger, otherCenterId])).rows[0].id;
    await expect(revokeInvitation(foreign, inviteAs(owner1, "OWNER"))).rejects.toThrow("La invitación no existe o ya no se puede revocar.");
  });

  it("hay un tope de invitaciones activas; las vencidas no cuentan", async () => {
    for (let i = 0; i < 25; i += 1) await createInvitation("VIEWER", inviteAs(owner1, "OWNER"));
    await expect(createInvitation("VIEWER", inviteAs(owner1, "OWNER"))).rejects.toThrow(/25 invitaciones activas/);
    await db.query("UPDATE \"InvitationCode\" SET \"expiresAt\" = now() - interval '1 day' WHERE id = (SELECT id FROM \"InvitationCode\" WHERE \"centerId\" = $1 LIMIT 1)", [centerId]);
    await expect(createInvitation("VIEWER", inviteAs(owner1, "OWNER"))).resolves.toBeDefined();
  });
});

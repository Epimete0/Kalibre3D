import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CENTER_LIMIT_MESSAGE, GENERIC_CENTER_ERROR, createCenter } from "@/lib/center-creation";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

/**
 * Crear un taller (PostgreSQL real).
 *
 * Carrera descrita: la misma persona envía dos veces «Crear mi taller» con identificadores distintos (dos pestañas). A y B
 * cuentan sus talleres propios (0), ambas insertan: la persona queda con dos. El candado por persona hace que B espere a A,
 * vea su taller y se rechace por el límite de uno.
 */

const run = process.env.RUN_TRANSACTION_INTEGRATION === "1";
const suite = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL;

let db: Client;
let prisma: PrismaClient;
let userA: string;
let userB: string;
let userC: string;
let authUserIds: string[] = [];

function localOnly() {
  if (!databaseUrl || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(databaseUrl).hostname)) throw new Error("Las pruebas de talleres requieren PostgreSQL local protegido.");
}

const form = (centerId: string, name = "Estética Aurora", timeZone = "America/Santiago") => {
  const data = new FormData();
  data.set("centerId", centerId);
  data.set("name", name);
  data.set("timeZone", timeZone);
  return data;
};
const create = (userId: string, centerId: string = randomUUID(), hook?: () => Promise<void>) => createCenter(form(centerId), { prisma, userId, afterLockAcquired: hook });
const count = async (sql: string, params: unknown[] = []) => Number((await db.query(sql, params)).rows[0].count);
const ownedBy = (userId: string) => count("SELECT count(*) FROM \"CenterMember\" WHERE \"userId\" = $1 AND role = 'OWNER' AND active", [userId]);

async function createAuthUser(id: string) {
  await db.query("INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')", [id, `${id}@center.test`]);
  await db.query("INSERT INTO \"Profile\" (id,\"updatedAt\") VALUES ($1,now())", [id]);
}

suite("Crear taller", () => {
  beforeAll(async () => {
    localOnly();
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
  });

  beforeEach(async () => {
    await applyPostgresMigrations(db);
    [userA, userB, userC] = [randomUUID(), randomUUID(), randomUUID()];
    authUserIds = [userA, userB, userC];
    for (const id of authUserIds) await createAuthUser(id);
  });

  afterEach(async () => { await cleanupPostgresFixture(db, authUserIds); authUserIds = []; });
  afterAll(async () => { await prisma.$disconnect(); await db.end(); });

  it("crea el taller y deja a la persona como OWNER activo, en una sola transacción", async () => {
    const centerId = randomUUID();
    const result = await create(userA, centerId);
    expect(result).toEqual({ centerId, created: true });
    expect((await db.query("SELECT name, \"timeZone\", active FROM \"Center\" WHERE id = $1", [centerId])).rows[0]).toEqual({ name: "Estética Aurora", timeZone: "America/Santiago", active: true });
    expect((await db.query("SELECT role, active FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [centerId, userA])).rows).toEqual([{ role: "OWNER", active: true }]);
    expect(await count("SELECT count(*) FROM \"CenterMember\" WHERE \"centerId\" = $1", [centerId])).toBe(1);
  });

  it("repetir el envío con el mismo identificador devuelve el mismo taller sin duplicarlo", async () => {
    const centerId = randomUUID();
    await create(userA, centerId);
    expect(await create(userA, centerId)).toEqual({ centerId, created: false });
    expect(await count("SELECT count(*) FROM \"Center\"")).toBe(1);
    expect(await ownedBy(userA)).toBe(1);
  });

  it("cuatro envíos simultáneos con el mismo identificador dejan un solo taller y una sola membresía", async () => {
    const centerId = randomUUID();
    const results = await Promise.all([1, 2, 3, 4].map(() => create(userA, centerId)));
    expect(results.every((result) => result.centerId === centerId)).toBe(true);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await count("SELECT count(*) FROM \"Center\"")).toBe(1);
    expect(await count("SELECT count(*) FROM \"CenterMember\" WHERE \"centerId\" = $1", [centerId])).toBe(1);
  });

  it("dos envíos simultáneos con identificadores distintos dejan a la persona con un solo taller", async () => {
    // Las dos transacciones llegan juntas hasta justo después de tomar el candado.
    let arrived = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const hook = async () => { arrived += 1; if (arrived === 2) release(); await Promise.race([gate, new Promise((resolve) => setTimeout(resolve, 1500))]); };
    const outcomes = await Promise.allSettled([create(userA, randomUUID(), hook), create(userA, randomUUID(), hook)]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.message).toBe(CENTER_LIMIT_MESSAGE);
    expect(await ownedBy(userA)).toBe(1);
    expect(await count("SELECT count(*) FROM \"Center\"")).toBe(1);
  });

  it("quien ya tiene un taller propio no puede crear otro", async () => {
    await create(userA);
    await expect(create(userA)).rejects.toThrow(CENTER_LIMIT_MESSAGE);
    expect(await count("SELECT count(*) FROM \"Center\"")).toBe(1);
  });

  it("un taller archivado ya no cuenta para el límite", async () => {
    const first = await create(userA);
    await db.query("UPDATE \"Center\" SET active = false WHERE id = $1", [first.centerId]);
    const second = await create(userA);
    expect(second.created).toBe(true);
    expect(await count("SELECT count(*) FROM \"Center\" WHERE active")).toBe(1);
  });

  it("quien solo es ayudante en el taller de otra persona sí puede crear el suyo", async () => {
    const owner = await create(userB);
    await db.query("INSERT INTO \"CenterMember\" (\"centerId\",\"userId\",role,\"updatedAt\") VALUES ($1,$2,'PROFESSIONAL',now())", [owner.centerId, userC]);
    const mine = await create(userC);
    expect(mine.created).toBe(true);
    expect(await ownedBy(userC)).toBe(1);
    expect((await db.query("SELECT role FROM \"CenterMember\" WHERE \"centerId\" = $1 AND \"userId\" = $2", [owner.centerId, userC])).rows[0].role).toBe("PROFESSIONAL");
  });

  it("usar el identificador de un taller ajeno se rechaza sin dar detalles y no toca ese taller", async () => {
    const theirs = await create(userB, randomUUID());
    await expect(create(userA, theirs.centerId)).rejects.toThrow(GENERIC_CENTER_ERROR);
    expect(await ownedBy(userA)).toBe(0);
    expect(await count("SELECT count(*) FROM \"CenterMember\" WHERE \"centerId\" = $1", [theirs.centerId])).toBe(1);
    expect((await db.query("SELECT name FROM \"Center\" WHERE id = $1", [theirs.centerId])).rows[0].name).toBe("Estética Aurora");
  });

  it("si algo falla a mitad de camino no queda un taller sin dueño", async () => {
    await db.query("DELETE FROM \"Profile\" WHERE id = $1", [userA]);
    await db.query("ALTER TABLE \"CenterMember\" ADD CONSTRAINT zz_force_failure CHECK (\"centerId\" IS NULL) NOT VALID");
    try {
      await expect(create(userA)).rejects.toThrow();
    } finally {
      await db.query("ALTER TABLE \"CenterMember\" DROP CONSTRAINT zz_force_failure");
    }
    expect(await count("SELECT count(*) FROM \"Center\"")).toBe(0);
  });

  it("una sesión normal no puede crear talleres, agregarse a uno ajeno ni modificarlo (RLS)", async () => {
    const theirs = await create(userB, randomUUID());
    const intruder = new Client({ connectionString: databaseUrl });
    await intruder.connect();
    try {
      await intruder.query("BEGIN");
      await intruder.query("GRANT INSERT, UPDATE ON \"Center\", \"CenterMember\" TO authenticated");
      await intruder.query("SET LOCAL ROLE authenticated");
      await intruder.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userA, role: "authenticated" })]);
      await expect(intruder.query("INSERT INTO \"Center\" (id, name, \"updatedAt\") VALUES ($1, 'Intruso', now())", [randomUUID()])).rejects.toThrow(/row-level security/);
      await intruder.query("ROLLBACK");

      await intruder.query("BEGIN");
      await intruder.query("GRANT INSERT, UPDATE ON \"Center\", \"CenterMember\" TO authenticated");
      await intruder.query("SET LOCAL ROLE authenticated");
      await intruder.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userA, role: "authenticated" })]);
      await expect(intruder.query("INSERT INTO \"CenterMember\" (\"centerId\",\"userId\",role,\"updatedAt\") VALUES ($1,$2,'OWNER',now())", [theirs.centerId, userA])).rejects.toThrow(/row-level security/);
      await intruder.query("ROLLBACK");

      await intruder.query("BEGIN");
      await intruder.query("GRANT INSERT, UPDATE ON \"Center\", \"CenterMember\" TO authenticated");
      await intruder.query("SET LOCAL ROLE authenticated");
      await intruder.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userA, role: "authenticated" })]);
      const update = await intruder.query("UPDATE \"Center\" SET name = 'Tomado' WHERE id = $1", [theirs.centerId]);
      expect(update.rowCount).toBe(0);
      await intruder.query("ROLLBACK");
    } finally {
      await intruder.end();
    }
    expect((await db.query("SELECT name FROM \"Center\" WHERE id = $1", [theirs.centerId])).rows[0].name).toBe("Estética Aurora");
    expect(await ownedBy(userA)).toBe(0);
  });
});

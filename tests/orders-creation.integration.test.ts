import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder } from "@/lib/order-service";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

const run = process.env.RUN_TRANSACTION_INTEGRATION === "1";
const suite = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL;

let db: Client;
let prisma: PrismaClient;
let userA: string;
let centerA: string;

function localOnly() {
  if (!databaseUrl || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("Las pruebas de creación de pedidos requieren PostgreSQL local protegido.");
  }
}

async function createAuthUser(id: string) {
  await db.query(
    "INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')",
    [id, `${id}@orders.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Creación de pedidos (Order) y concurrencia en PostgreSQL", () => {
  beforeAll(async () => {
    localOnly();
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    prisma = new PrismaClient({ adapter: new PrismaPg(db) });
  });

  beforeEach(async () => {
    await applyPostgresMigrations(db);
    userA = randomUUID();
    centerA = randomUUID();
    await createAuthUser(userA);
    await db.query(
      'INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller Pedidos\',\'America/Santiago\',now())',
      [centerA]
    );
    await db.query(
      'INSERT INTO "CenterMember" ("centerId","userId",role,"updatedAt") VALUES ($1,$2,\'OWNER\',now())',
      [centerA, userA]
    );
  });

  afterEach(async () => {
    await cleanupPostgresFixture(db, [userA]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.end();
  });

  it("dos pedidos simultáneos reciben números distintos y consecutivos sin colisión", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    const op1 = randomUUID();
    const op2 = randomUUID();

    // Lanzar 2 pedidos concurrentemente contra la base real
    const [res1, res2] = await Promise.all([
      createOrder({
        operationId: op1,
        kind: "QUICK_SALE",
        channel: "IN_PERSON",
        items: [{ description: "Pieza A", qty: 1, unitPrice: 2000 }],
      }),
      createOrder({
        operationId: op2,
        kind: "QUICK_SALE",
        channel: "IN_PERSON",
        items: [{ description: "Pieza B", qty: 2, unitPrice: 1500 }],
      }),
    ]);

    expect(res1.id).not.toBe(res2.id);
    const numbers = [res1.number, res2.number].sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2]);

    const countCheck = await db.query(
      'SELECT count(*)::int as count FROM "Order" WHERE "centerId" = $1',
      [centerA]
    );
    expect(countCheck.rows[0].count).toBe(2);
  });

  it("el mismo operationId dos veces crea un solo pedido (idempotencia)", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    const op = randomUUID();

    const first = await createOrder({
      operationId: op,
      kind: "QUICK_SALE",
      channel: "WHATSAPP",
      items: [{ description: "Llavero", qty: 1, unitPrice: 3000 }],
    });

    // Reenvío del mismo formulario
    const second = await createOrder({
      operationId: op,
      kind: "QUICK_SALE",
      channel: "WHATSAPP",
      items: [{ description: "Llavero", qty: 1, unitPrice: 3000 }],
    });

    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);

    const check = await db.query(
      'SELECT count(*)::int as count FROM "Order" WHERE "centerId" = $1 AND "operationId" = $2',
      [centerA, op]
    );
    expect(check.rows[0].count).toBe(1);

    const eventCheck = await db.query(
      'SELECT count(*)::int as count FROM "OrderEvent" WHERE "centerId" = $1 AND "orderId" = $2',
      [centerA, first.id]
    );
    expect(eventCheck.rows[0].count).toBe(1);
  });
});

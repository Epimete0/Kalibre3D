import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/action-errors";
import { changeOrderStatus, createOrder } from "@/lib/order-service";
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
    throw new Error("Las pruebas de cambio de estado requieren PostgreSQL local protegido.");
  }
}

async function createAuthUser(id: string) {
  await db.query(
    "INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')",
    [id, `${id}@status.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Cambio de estado de pedidos (Order) y concurrencia en PostgreSQL", () => {
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
      'INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller Estados\',\'America/Santiago\',now())',
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

  it("dos cambios simultáneos con la misma versión: gana exactamente uno y el otro rechaza con DomainError de versión", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    const created = await createOrder({
      operationId: randomUUID(),
      kind: "ORDER",
      channel: "WHATSAPP",
      status: "CONFIRMED",
      items: [{ description: "Soporte pared", qty: 1, unitPrice: 5000 }],
    });

    const results = await Promise.allSettled([
      changeOrderStatus({
        orderId: created.id,
        expectedVersion: 1,
        to: "PRINTING",
      }),
      changeOrderStatus({
        orderId: created.id,
        expectedVersion: 1,
        to: "CANCELED",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DomainError);
    expect((rejected[0].reason as DomainError).message).toContain("fue modificado por otra persona");

    const orderCheck = await db.query(
      'SELECT status, version FROM "Order" WHERE "centerId" = $1 AND id = $2',
      [centerA, created.id]
    );
    expect(orderCheck.rows[0].version).toBe(2);
    expect(orderCheck.rows[0].status).toBe(fulfilled[0].value.status);

    const eventsCheck = await db.query(
      'SELECT version, "fromStatus", "toStatus" FROM "OrderEvent" WHERE "centerId" = $1 AND "orderId" = $2 ORDER BY version ASC',
      [centerA, created.id]
    );
    expect(eventsCheck.rows).toHaveLength(2);
    expect(eventsCheck.rows[0]).toEqual({ version: 1, fromStatus: null, toStatus: "CONFIRMED" });
    expect(eventsCheck.rows[1]).toEqual({
      version: 2,
      fromStatus: "CONFIRMED",
      toStatus: fulfilled[0].value.status,
    });
  });

  it("avanza por el ciclo de estados, fija deliveredAt al entregar y rechaza versión obsoleta", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    const created = await createOrder({
      operationId: randomUUID(),
      kind: "ORDER",
      channel: "INSTAGRAM",
      status: "QUOTED",
      items: [{ description: "Llavero personalizado", qty: 3, unitPrice: 1500 }],
    });

    const step1 = await changeOrderStatus({ orderId: created.id, expectedVersion: 1, to: "CONFIRMED" });
    expect(step1.version).toBe(2);

    // Intentar usar versión obsoleta (1) debe fallar con DomainError
    await expect(
      changeOrderStatus({ orderId: created.id, expectedVersion: 1, to: "PRINTING" })
    ).rejects.toThrow("fue modificado por otra persona");

    const step2 = await changeOrderStatus({ orderId: created.id, expectedVersion: 2, to: "PRINTING" });
    expect(step2.version).toBe(3);

    const step3 = await changeOrderStatus({ orderId: created.id, expectedVersion: 3, to: "READY" });
    expect(step3.version).toBe(4);

    const step4 = await changeOrderStatus({ orderId: created.id, expectedVersion: 4, to: "DELIVERED" });
    expect(step4.version).toBe(5);

    const orderRow = await db.query(
      'SELECT status, version, "deliveredAt" FROM "Order" WHERE "centerId" = $1 AND id = $2',
      [centerA, created.id]
    );
    expect(orderRow.rows[0].status).toBe("DELIVERED");
    expect(orderRow.rows[0].version).toBe(5);
    expect(orderRow.rows[0].deliveredAt).not.toBeNull();
  });
});

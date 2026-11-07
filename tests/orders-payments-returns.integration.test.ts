import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/action-errors";
import {
  createOrder,
  registerPayment,
  returnOrder,
  voidMoneyTransaction,
} from "@/lib/order-service";
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
    throw new Error("Las pruebas de cobros y devoluciones requieren PostgreSQL local protegido.");
  }
}

async function createAuthUser(id: string) {
  await db.query(
    "INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')",
    [id, `${id}@payments.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Cobros, anulaciones y devoluciones atómicas (Tarea 1.7) en PostgreSQL", () => {
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
      'INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller Cobros\',\'America/Santiago\',now())',
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

  it("el mismo operationId dos veces (incluso en paralelo) registra un único cobro sin duplicar", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = {
      userId: userA,
      centerId: centerA,
      role: "OWNER" as const,
      timeZone: "America/Santiago",
    };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);

    const order = await createOrder({
      operationId: randomUUID(),
      kind: "ORDER",
      channel: "WHATSAPP",
      status: "CONFIRMED",
      items: [{ description: "Pieza A", qty: 1, unitPrice: 12000 }],
    });

    const paymentOpId = randomUUID();

    const [p1, p2] = await Promise.all([
      registerPayment({
        orderId: order.id,
        operationId: paymentOpId,
        amount: 6000,
        method: "TRANSFER",
      }),
      registerPayment({
        orderId: order.id,
        operationId: paymentOpId,
        amount: 6000,
        method: "TRANSFER",
      }),
    ]);

    expect(p1.id).toBe(p2.id);

    const countCheck = await db.query(
      'SELECT count(*)::int as count FROM "MoneyTransaction" WHERE "centerId" = $1 AND "orderId" = $2',
      [centerA, order.id]
    );
    expect(countCheck.rows[0].count).toBe(1);
  });

  it("anular un movimiento dos veces (secuencial o concurrente) se rechaza con DomainError", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = {
      userId: userA,
      centerId: centerA,
      role: "OWNER" as const,
      timeZone: "America/Santiago",
    };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);

    const order = await createOrder({
      operationId: randomUUID(),
      kind: "ORDER",
      channel: "INSTAGRAM",
      status: "CONFIRMED",
      items: [{ description: "Pieza B", qty: 1, unitPrice: 8000 }],
    });

    const payment = await registerPayment({
      orderId: order.id,
      operationId: randomUUID(),
      amount: 8000,
      method: "CASH",
    });

    const results = await Promise.allSettled([
      voidMoneyTransaction({
        transactionId: payment.id,
        reason: "Monto ingresado por error",
      }),
      voidMoneyTransaction({
        transactionId: payment.id,
        reason: "Segundo intento simultáneo",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(DomainError);
    expect((rejected[0].reason as DomainError).message).toContain("ya fue anulado");

    // Un tercer intento secuencial también debe rechazarse
    await expect(
      voidMoneyTransaction({
        transactionId: payment.id,
        reason: "Tercer intento",
      })
    ).rejects.toThrow("ya fue anulado");
  });

  it("la devolución (D6) es atómica: pasa a RETURNED, conserva deliveredAt, crea evento y gasto REFUNDS; si falla el gasto, el pedido no cambia", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = {
      userId: userA,
      centerId: centerA,
      role: "OWNER" as const,
      timeZone: "America/Santiago",
    };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);

    const order = await createOrder({
      operationId: randomUUID(),
      kind: "QUICK_SALE",
      channel: "MERCADOLIBRE",
      mlCommission: 1708,
      mlShippingCost: 799,
      items: [{ description: "Emblema ML", qty: 1, unitPrice: 8990 }],
      initialPayment: { amount: 6483, method: "MERCADOLIBRE" },
    });

    const existingPaymentOpId = randomUUID();
    await registerPayment({
      orderId: order.id,
      operationId: existingPaymentOpId,
      amount: 6483,
      method: "MERCADOLIBRE",
    });

    // Intentar devolver usando un operationId ya ocupado en MoneyTransaction
    // para forzar un fallo en tx.moneyTransaction.create DESPUÉS de tx.order.update y tx.orderEvent.create,
    // demostrando que el ROLLBACK de la transacción deja el pedido intacto en DELIVERED v1.
    await expect(
      returnOrder({
        orderId: order.id,
        expectedVersion: 1,
        operationId: existingPaymentOpId,
        refundAmount: 6483,
        method: "MERCADOLIBRE",
      })
    ).rejects.toThrow();

    const stillDelivered = await db.query(
      'SELECT status, version FROM "Order" WHERE "centerId" = $1 AND id = $2',
      [centerA, order.id]
    );
    expect(stillDelivered.rows[0].status).toBe("DELIVERED");
    expect(stillDelivered.rows[0].version).toBe(1);

    // Ahora ejecutar la devolución válida
    const refundOpId = randomUUID();
    const returnInput = {
      orderId: order.id,
      expectedVersion: 1,
      operationId: refundOpId,
      refundAmount: 6483,
      method: "MERCADOLIBRE" as const,
      notes: "Devolución comprador ML",
    };
    const returned = await returnOrder(returnInput);

    expect(returned.status).toBe("RETURNED");
    expect(returned.version).toBe(2);

    // Reintentar la misma devolución (doble clic o reenvío) devuelve el mismo resultado sin duplicar el gasto.
    const retried = await returnOrder(returnInput);
    expect(retried.transactionId).toBe(returned.transactionId);
    const refundCount = await db.query(
      'SELECT count(*)::int AS n FROM "MoneyTransaction" WHERE "centerId" = $1 AND "operationId" = $2',
      [centerA, refundOpId]
    );
    expect(refundCount.rows[0].n).toBe(1);

    // El operationId de la devolución no puede reutilizarse como cobro: se rechaza en vez de fingir éxito.
    await expect(
      registerPayment({ orderId: order.id, operationId: refundOpId, amount: 1000, method: "CASH" })
    ).rejects.toThrow("Esta operación ya se usó para otro movimiento");

    const afterReturn = await db.query(
      'SELECT status, version, "deliveredAt" FROM "Order" WHERE "centerId" = $1 AND id = $2',
      [centerA, order.id]
    );
    expect(afterReturn.rows[0].status).toBe("RETURNED");
    expect(afterReturn.rows[0].version).toBe(2);
    expect(afterReturn.rows[0].deliveredAt).not.toBeNull();

    const refundTx = await db.query(
      'SELECT type, category, amount, method FROM "MoneyTransaction" WHERE "centerId" = $1 AND id = $2',
      [centerA, returned.transactionId]
    );
    expect(refundTx.rows[0]).toEqual({
      type: "EXPENSE",
      category: "REFUNDS",
      amount: 6483,
      method: "MERCADOLIBRE",
    });
  });
});

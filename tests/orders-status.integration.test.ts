import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/action-errors";
import { changeOrderStatus, createOrder, registerPayment, returnOrder } from "@/lib/order-service";
import { getMonthlySalesEconomics } from "@/lib/insights-queries";
import { getMonthlyMoneyView } from "@/lib/money-queries";
import { listOrders, getOrderDetail } from "@/lib/order-queries";
import { getSpoolDetail } from "@/lib/spool-queries";
import { getProductById } from "@/lib/product-queries";
import { createSpool, recordSpoolMovement } from "@/lib/spool-service";
import { createProduct, recordProductMovement } from "@/lib/product-service";
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
    vi.restoreAllMocks();
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

  it("no permite consumir filamento después de anular un pedido durante un consumo concurrente", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireAuthContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "ORDER", channel: "WHATSAPP", status: "CONFIRMED", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }] });
    const spool = await createSpool({ operationId: randomUUID(), material: "PETG", color: "Negro", totalGrams: 1000, remainingGrams: 500, pricePaid: 15000 });

    // El consumo compite con la anulación: si ocurre primero debe compensarse;
    // si ocurre después debe rechazarse. En ambos casos quedan 500 g.
    const results = await Promise.allSettled([
      recordSpoolMovement({ operationId: randomUUID(), spoolId: spool.id, orderId: order.id, kind: "CONSUME", deltaGrams: 100 }),
      changeOrderStatus({ orderId: order.id, expectedVersion: 1, to: "CANCELED" }),
    ]);
    expect(results[1].status).toBe("fulfilled");
    const result = await db.query('SELECT "remainingGrams" FROM "Spool" WHERE id = $1', [spool.id]);
    expect(result.rows[0].remainingGrams).toBe(500);
  });

  it("anula el cobro y compensa el filamento del pedido exactamente una vez", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireAuthContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "ORDER", channel: "WHATSAPP", status: "CONFIRMED", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }], initialPayment: { amount: 2000, method: "CASH" } });
    const spool = await createSpool({ operationId: randomUUID(), material: "PETG", color: "Negro", totalGrams: 1000, remainingGrams: 500, pricePaid: 15000 });
    const productForm = new FormData();
    productForm.set("name", "Pieza");
    productForm.set("salePrice", "5000");
    productForm.set("initialStock", "5");
    const product = await createProduct(productForm);
    await recordProductMovement({ operationId: randomUUID(), productId: product.id, orderId: order.id, kind: "EXIT", delta: 2 });
    await recordSpoolMovement({ operationId: randomUUID(), spoolId: spool.id, orderId: order.id, kind: "CONSUME", deltaGrams: 100 });
    await changeOrderStatus({ orderId: order.id, expectedVersion: 1, to: "CANCELED" });
    await expect(changeOrderStatus({ orderId: order.id, expectedVersion: 1, to: "CANCELED" })).rejects.toThrow();
    const spoolRow = await db.query('SELECT "remainingGrams" FROM "Spool" WHERE id = $1', [spool.id]);
    expect(spoolRow.rows[0].remainingGrams).toBe(500);
    const productRow = await db.query('SELECT "currentStock" FROM "Product" WHERE id = $1', [product.id]);
    expect(productRow.rows[0].currentStock).toBe(5);
    const payments = await db.query('SELECT "voidedAt" FROM "MoneyTransaction" WHERE "orderId" = $1', [order.id]);
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0].voidedAt).not.toBeNull();
    const adjustments = await db.query('SELECT "deltaGrams" FROM "SpoolMovement" WHERE "orderId" = $1 ORDER BY "deltaGrams"', [order.id]);
    expect(adjustments.rows).toEqual([{ deltaGrams: -100 }, { deltaGrams: 100 }]);
    expect((await listOrders()).some((item) => item.id === order.id)).toBe(false);
    expect(await getOrderDetail(order.id)).toBeNull();
    expect((await getMonthlyMoneyView()).transactions.some((item) => item.orderId === order.id)).toBe(false);
    const spoolDetail = await getSpoolDetail(spool.id);
    const productDetail = await getProductById(product.id);
    expect(spoolDetail?.movements.every((item) => item.orderId !== order.id)).toBe(true);
    expect(productDetail?.movements.every((item) => item.orderId !== order.id)).toBe(true);
  });

  it("una devolución completa conserva el costo de fabricación y elimina el ingreso neto", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "QUICK_SALE", channel: "WHATSAPP", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }], initialPayment: { amount: 5000, method: "CASH" } });
    await db.query('UPDATE "OrderItem" SET "unitCost" = 500 WHERE "centerId" = $1 AND "orderId" = $2', [centerA, order.id]);
    await returnOrder({ orderId: order.id, expectedVersion: 1, operationId: randomUUID(), refundAmount: 5000, method: "CASH" });
    const result = await getMonthlySalesEconomics();
    expect(result.summary.grossRevenue).toBe(0);
    expect(result.summary.productionCost).toBe(500);
    expect(result.summary.netProfit).toBe(-500);
    expect(result.orderAccounts[0].productionCost).toBe(500);
    expect(result.orderAccounts[0].netRevenue).toBe(0);
  });

  it("las cuentas mensuales incluyen solo cobros reales, con costo completo en el primer abono", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "ORDER", channel: "MERCADOLIBRE", status: "CONFIRMED", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }] });
    await db.query('UPDATE "OrderItem" SET "unitCost" = 1000 WHERE "centerId" = $1 AND "orderId" = $2', [centerA, order.id]);
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" }).format(new Date());
    expect((await getMonthlySalesEconomics({ month })).summary.grossRevenue).toBe(0);
    await registerPayment({ orderId: order.id, operationId: randomUUID(), amount: 2000, method: "MERCADOLIBRE", occurredOn: `${month}-01` });
    const afterFirst = await getMonthlySalesEconomics({ month });
    expect(afterFirst.summary.grossRevenue).toBe(2000);
    expect(afterFirst.summary.productionCost).toBe(1000);
    await registerPayment({ orderId: order.id, operationId: randomUUID(), amount: 3000, method: "MERCADOLIBRE", occurredOn: `${month}-02` });
    const afterSecond = await getMonthlySalesEconomics({ month });
    expect(afterSecond.summary.grossRevenue).toBe(5000);
    expect(afterSecond.summary.productionCost).toBe(1000);
  });

  it("distribuye abonos y una devolución en sus meses sin duplicar el costo", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "QUICK_SALE", channel: "MERCADOLIBRE", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }] });
    await db.query('UPDATE "OrderItem" SET "unitCost" = 1000 WHERE "centerId" = $1 AND "orderId" = $2', [centerA, order.id]);
    await registerPayment({ orderId: order.id, operationId: randomUUID(), amount: 2000, method: "MERCADOLIBRE", occurredOn: "2026-10-31" });
    await registerPayment({ orderId: order.id, operationId: randomUUID(), amount: 3000, method: "MERCADOLIBRE", occurredOn: "2026-11-02" });
    await returnOrder({ orderId: order.id, expectedVersion: 1, operationId: randomUUID(), refundAmount: 5000, method: "TRANSFER", occurredOn: "2026-12-01" });
    const october = await getMonthlySalesEconomics({ month: "2026-10" });
    const november = await getMonthlySalesEconomics({ month: "2026-11" });
    const december = await getMonthlySalesEconomics({ month: "2026-12" });
    expect(october.summary).toMatchObject({ grossRevenue: 2000, productionCost: 1000, netProfit: 1000 });
    expect(november.summary).toMatchObject({ grossRevenue: 3000, productionCost: 0, netProfit: 3000 });
    expect(december.summary).toMatchObject({ grossRevenue: -5000, productionCost: 0, netProfit: -5000 });
    expect(october.orderAccounts[0].createdOn).toBe("2026-10-31");
    expect(november.orderAccounts[0].createdOn).toBe("2026-11-02");
    expect(december.orderAccounts[0].createdOn).toBe("2026-12-01");
  });

  it("una venta rápida entregada por error se puede anular y su cobro deja de contar", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "QUICK_SALE", channel: "WHATSAPP", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }], initialPayment: { amount: 5000, method: "CASH" } });
    await changeOrderStatus({ orderId: order.id, expectedVersion: 1, to: "CANCELED" });
    const result = await db.query('SELECT o.status, o."deliveredAt", t."voidedAt" FROM "Order" o JOIN "MoneyTransaction" t ON t."centerId" = o."centerId" AND t."orderId" = o.id WHERE o.id = $1', [order.id]);
    expect(result.rows[0].status).toBe("CANCELED");
    expect(result.rows[0].deliveredAt).toBeNull();
    expect(result.rows[0].voidedAt).not.toBeNull();
  });

  it("un ayudante puede crear sin cobro pero no puede crear con pago inicial", async () => {
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({ userId: userA, centerId: centerA, role: "PROFESSIONAL", timeZone: "America/Santiago" });
    const input = { kind: "QUICK_SALE" as const, channel: "WHATSAPP" as const, items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }] };
    const forbiddenOperation = randomUUID();
    await expect(createOrder({ ...input, operationId: forbiddenOperation, initialPayment: { amount: 5000, method: "CASH" } })).rejects.toThrow("Solo el dueño o administrador puede registrar cobros.");
    const rejected = await db.query('SELECT count(*)::int AS count FROM "Order" WHERE "centerId" = $1 AND "operationId" = $2', [centerA, forbiddenOperation]);
    expect(rejected.rows[0].count).toBe(0);
    const order = await createOrder({ ...input, operationId: randomUUID() });
    const payments = await db.query('SELECT count(*)::int AS count FROM "MoneyTransaction" WHERE "centerId" = $1 AND "orderId" = $2', [centerA, order.id]);
    expect(payments.rows[0].count).toBe(0);
  });

  it("un ayudante no puede anular un pedido y revertir sus cobros", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = { userId: userA, centerId: centerA, role: "OWNER" as const, timeZone: "America/Santiago" };
    const guard = vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);
    const order = await createOrder({ operationId: randomUUID(), kind: "QUICK_SALE", channel: "WHATSAPP", items: [{ description: "Pieza", qty: 1, unitPrice: 5000 }], initialPayment: { amount: 5000, method: "CASH" } });
    guard.mockResolvedValue({ ...ctx, role: "PROFESSIONAL" });
    await expect(changeOrderStatus({ orderId: order.id, expectedVersion: 1, to: "CANCELED" })).rejects.toThrow("Solo el dueño o administrador");
    const result = await db.query('SELECT status FROM "Order" WHERE id = $1', [order.id]);
    expect(result.rows[0].status).toBe("DELIVERED");
  });
});

// Integridad de la Fase 1 en PostgreSQL real (saas3d-test): la base rechaza lo que la app nunca debería hacer,
// aunque la app tuviera un error. Ver onyx.md 18.2 (D2–D12) y la migración 20261108000000_phase1_orders_money.
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

const run = process.env.RUN_TRANSACTION_INTEGRATION === "1";
const describeIntegration = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL!;
const db = run ? new Client({ connectionString: databaseUrl }) : null;

const ids = { centerA: randomUUID(), centerB: randomUUID(), userA: randomUUID(), userB: randomUUID() };
const q = (sql: string, params: unknown[] = []) => db!.query(sql, params);

async function createUser(id: string, email: string) {
  await q("INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES ($1, $2, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')", [id, email]);
}

async function insertOrder(centerId: string, userId: string, number: number, extra: Record<string, unknown> = {}) {
  const values = { channel: "WHATSAPP", status: "QUOTED", kind: "ORDER", customerId: null, mlCommission: 0, mlShippingCost: 0, mlOrderRef: null, deliveredAt: null, ...extra };
  const result = await q(
    "INSERT INTO \"Order\" (\"centerId\",number,\"operationId\",kind,\"customerId\",channel,status,\"mlCommission\",\"mlShippingCost\",\"mlOrderRef\",\"deliveredAt\",\"createdByUserId\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
    [centerId, number, randomUUID(), values.kind, values.customerId, values.channel, values.status, values.mlCommission, values.mlShippingCost, values.mlOrderRef, values.deliveredAt, userId],
  );
  return result.rows[0].id as string;
}

async function insertMoney(centerId: string, userId: string, extra: Record<string, unknown> = {}) {
  const values = { type: "EXPENSE", category: "FILAMENT", amount: 15000, orderId: null, ...extra };
  const result = await q(
    "INSERT INTO \"MoneyTransaction\" (\"centerId\",\"operationId\",type,category,amount,\"occurredOn\",method,\"orderId\",\"recordedByUserId\") VALUES ($1,$2,$3,$4,$5,'2026-11-08','TRANSFER',$6,$7) RETURNING id",
    [centerId, randomUUID(), values.type, values.category, values.amount, values.orderId, userId],
  );
  return result.rows[0].id as string;
}

describeIntegration("integridad de la Fase 1 en PostgreSQL", () => {
  beforeAll(async () => { await db!.connect(); });
  beforeEach(async () => {
    await applyPostgresMigrations(db!);
    await createUser(ids.userA, `a-${randomUUID()}@phase1.test`);
    await createUser(ids.userB, `b-${randomUUID()}@phase1.test`);
    await q("INSERT INTO \"Center\" (id,name,\"updatedAt\") VALUES ($1,'Taller A',now()),($2,'Taller B',now())", [ids.centerA, ids.centerB]);
    await q("INSERT INTO \"Profile\" (id,\"updatedAt\") VALUES ($1,now()),($2,now())", [ids.userA, ids.userB]);
    await q("INSERT INTO \"CenterMember\" (\"centerId\",\"userId\",role,\"updatedAt\") VALUES ($1,$2,'OWNER',now()),($3,$4,'OWNER',now())", [ids.centerA, ids.userA, ids.centerB, ids.userB]);
  });
  afterEach(async () => { await cleanupPostgresFixture(db!, [ids.userA, ids.userB]); });
  afterAll(async () => { await db!.end(); });

  it("no deja usar un cliente, una pieza o un autor de otro taller", async () => {
    const customerB = (await q("INSERT INTO \"Customer\" (\"centerId\",name,\"createdByUserId\") VALUES ($1,'Cliente B',$2) RETURNING id", [ids.centerB, ids.userB])).rows[0].id;
    await expect(insertOrder(ids.centerA, ids.userA, 1, { customerId: customerB })).rejects.toMatchObject({ code: "23503" });
    await expect(insertOrder(ids.centerA, ids.userB, 1)).rejects.toMatchObject({ code: "23503" });
    const productB = (await q("INSERT INTO \"Product\" (\"centerId\",name,\"salePrice\",\"createdByUserId\") VALUES ($1,'Emblema B',8990,$2) RETURNING id", [ids.centerB, ids.userB])).rows[0].id;
    const orderA = await insertOrder(ids.centerA, ids.userA, 1);
    await expect(q("INSERT INTO \"OrderItem\" (\"centerId\",\"orderId\",position,\"productId\",description,qty,\"unitPrice\") VALUES ($1,$2,0,$3,'x',1,1)", [ids.centerA, orderA, productB])).rejects.toMatchObject({ code: "23503" });
    const orderB = await insertOrder(ids.centerB, ids.userB, 1);
    await expect(insertMoney(ids.centerA, ids.userA, { type: "INCOME", category: "ORDER_PAYMENT", orderId: orderB })).rejects.toMatchObject({ code: "23503" });
  });

  it("el número de venta no se repite dentro de un taller pero sí entre talleres", async () => {
    await insertOrder(ids.centerA, ids.userA, 1);
    await expect(insertOrder(ids.centerA, ids.userA, 1)).rejects.toMatchObject({ code: "23505" });
    await expect(insertOrder(ids.centerB, ids.userB, 1)).resolves.toBeTruthy();
  });

  it("solo Mercado Libre lleva comisión y envío ML, y la entrega exige fecha", async () => {
    await expect(insertOrder(ids.centerA, ids.userA, 1, { channel: "WHATSAPP", mlCommission: 100 })).rejects.toMatchObject({ code: "23514" });
    await expect(insertOrder(ids.centerA, ids.userA, 2, { channel: "MERCADOLIBRE", mlCommission: 1708, mlShippingCost: 799 })).resolves.toBeTruthy();
    await expect(insertOrder(ids.centerA, ids.userA, 3, { status: "DELIVERED" })).rejects.toMatchObject({ code: "23514" });
    await expect(insertOrder(ids.centerA, ids.userA, 4, { status: "DELIVERED", kind: "QUICK_SALE", deliveredAt: new Date() })).resolves.toBeTruthy();
    await expect(insertOrder(ids.centerA, ids.userA, 5, { status: "QUOTED", deliveredAt: new Date() })).rejects.toMatchObject({ code: "23514" });
  });

  it("el historial de estados no se modifica ni se borra", async () => {
    const order = await insertOrder(ids.centerA, ids.userA, 1);
    await q("INSERT INTO \"OrderEvent\" (\"centerId\",\"orderId\",version,\"fromStatus\",\"toStatus\",\"actorUserId\") VALUES ($1,$2,1,NULL,'QUOTED',$3)", [ids.centerA, order, ids.userA]);
    await expect(q("UPDATE \"OrderEvent\" SET \"toStatus\"='DELIVERED' WHERE \"orderId\"=$1", [order])).rejects.toMatchObject({ code: "23514" });
    await expect(q("DELETE FROM \"OrderEvent\" WHERE \"orderId\"=$1", [order])).rejects.toMatchObject({ code: "23514" });
    await expect(q("INSERT INTO \"OrderEvent\" (\"centerId\",\"orderId\",version,\"toStatus\",\"actorUserId\") VALUES ($1,$2,1,'CONFIRMED',$3)", [ids.centerA, order, ids.userA])).rejects.toMatchObject({ code: "23505" });
  });

  it("una venta con historial o dinero no se borra", async () => {
    const plain = await insertOrder(ids.centerA, ids.userA, 1);
    await expect(q("DELETE FROM \"Order\" WHERE id=$1", [plain])).resolves.toBeTruthy();
    const withEvent = await insertOrder(ids.centerA, ids.userA, 2);
    await q("INSERT INTO \"OrderEvent\" (\"centerId\",\"orderId\",version,\"toStatus\",\"actorUserId\") VALUES ($1,$2,1,'QUOTED',$3)", [ids.centerA, withEvent, ids.userA]);
    await expect(q("DELETE FROM \"Order\" WHERE id=$1", [withEvent])).rejects.toMatchObject({ code: "23514" });
  });

  it("el dinero no se borra, se anula una sola vez con motivo, y no cambia otro dato", async () => {
    const money = await insertMoney(ids.centerA, ids.userA);
    await expect(q("DELETE FROM \"MoneyTransaction\" WHERE id=$1", [money])).rejects.toMatchObject({ code: "23514" });
    await expect(q("UPDATE \"MoneyTransaction\" SET amount=1 WHERE id=$1", [money])).rejects.toMatchObject({ code: "23514" });
    await expect(q("UPDATE \"MoneyTransaction\" SET \"voidedAt\"=now(), \"voidedByUserId\"=$2 WHERE id=$1", [money, ids.userA])).rejects.toMatchObject({ code: "23514" });
    await expect(q("UPDATE \"MoneyTransaction\" SET \"voidedAt\"=now(), \"voidedByUserId\"=$2, \"voidReason\"='Error de digitación', amount=1 WHERE id=$1", [money, ids.userA])).rejects.toMatchObject({ code: "23514" });
    await q("UPDATE \"MoneyTransaction\" SET \"voidedAt\"=now(), \"voidedByUserId\"=$2, \"voidReason\"='Error de digitación' WHERE id=$1", [money, ids.userA]);
    await expect(q("UPDATE \"MoneyTransaction\" SET \"voidReason\"='Otro motivo' WHERE id=$1", [money])).rejects.toMatchObject({ code: "23514" });
    const row = (await q("SELECT amount, \"voidReason\" FROM \"MoneyTransaction\" WHERE id=$1", [money])).rows[0];
    expect(row).toEqual({ amount: 15000, voidReason: "Error de digitación" });
  });

  it("cobros y reembolsos siempre pertenecen a una venta, y las categorías coinciden con el tipo", async () => {
    await expect(insertMoney(ids.centerA, ids.userA, { type: "INCOME", category: "ORDER_PAYMENT" })).rejects.toMatchObject({ code: "23514" });
    await expect(insertMoney(ids.centerA, ids.userA, { type: "EXPENSE", category: "REFUNDS" })).rejects.toMatchObject({ code: "23514" });
    await expect(insertMoney(ids.centerA, ids.userA, { type: "INCOME", category: "FILAMENT" })).rejects.toMatchObject({ code: "23514" });
    await expect(insertMoney(ids.centerA, ids.userA, { type: "INCOME", category: "DIGITAL_SALE", amount: 2500 })).resolves.toBeTruthy();
    await expect(insertMoney(ids.centerA, ids.userA, { amount: 0 })).rejects.toMatchObject({ code: "23514" });
  });

  it("ningún registro cambia de taller", async () => {
    const customer = (await q("INSERT INTO \"Customer\" (\"centerId\",name,\"createdByUserId\") VALUES ($1,'Cliente A',$2) RETURNING id", [ids.centerA, ids.userA])).rows[0].id;
    await expect(q("UPDATE \"Customer\" SET \"centerId\"=$2 WHERE id=$1", [customer, ids.centerB])).rejects.toMatchObject({ code: "23514" });
    await q("INSERT INTO \"CenterSettings\" (\"centerId\") VALUES ($1)", [ids.centerA]);
    await expect(q("UPDATE \"CenterSettings\" SET \"centerId\"=$2 WHERE \"centerId\"=$1", [ids.centerA, ids.centerB])).rejects.toMatchObject({ code: "23514" });
  });

  it("los nombres de la lista de precios no se repiten (sin importar mayúsculas ni espacios) y la moneda es válida", async () => {
    await q("INSERT INTO \"Product\" (\"centerId\",name,\"salePrice\",\"mlPrice\",\"createdByUserId\") VALUES ($1,'Emblema Toyota 13x9',8990,9990,$2)", [ids.centerA, ids.userA]);
    await expect(q("INSERT INTO \"Product\" (\"centerId\",name,\"salePrice\",\"createdByUserId\") VALUES ($1,' emblema toyota 13x9 ',8990,$2)", [ids.centerA, ids.userA])).rejects.toMatchObject({ code: "23505" });
    await expect(q("INSERT INTO \"Product\" (\"centerId\",name,\"salePrice\",\"createdByUserId\") VALUES ($1,'Emblema Toyota 13x9',8990,$2)", [ids.centerB, ids.userB])).resolves.toBeTruthy();
    await expect(q("INSERT INTO \"CenterSettings\" (\"centerId\",currency) VALUES ($1,'BTC')", [ids.centerA])).rejects.toMatchObject({ code: "23514" });
  });
});

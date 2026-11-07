// Integridad de la Fase 2 en PostgreSQL real (saas3d-test): stock de piezas, bobinas de filamento,
// movimientos inmutables, aislamiento multi-taller y reglas de eliminación.
// Ver onyx.md 18.3 (D13–D18) y la migración 20261109000000_phase2_catalog_spools_stock.
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

async function insertProduct(centerId: string, userId: string, name: string, extra: Record<string, unknown> = {}) {
  const values = {
    category: "Emblemas",
    material: "PETG",
    grams: 50,
    printMinutes: 90,
    colorsCount: 2,
    purgeGrams: 15,
    salePrice: 8990,
    currentStock: 0,
    minStock: 2,
    ...extra,
  };
  const res = await q(
    `INSERT INTO "Product" ("centerId", name, category, material, grams, "printMinutes", "colorsCount", "purgeGrams", "salePrice", "currentStock", "minStock", "createdByUserId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      centerId,
      name,
      values.category,
      values.material,
      values.grams,
      values.printMinutes,
      values.colorsCount,
      values.purgeGrams,
      values.salePrice,
      values.currentStock,
      values.minStock,
      userId,
    ],
  );
  return res.rows[0].id as string;
}

async function insertSpool(centerId: string, userId: string, extra: Record<string, unknown> = {}) {
  const values = {
    material: "PETG",
    color: "Negro",
    brand: "eSUN",
    totalGrams: 1000,
    remainingGrams: 1000,
    pricePaid: 15000,
    purchasedOn: "2026-11-08",
    ...extra,
  };
  const res = await q(
    `INSERT INTO "Spool" ("centerId", material, color, brand, "totalGrams", "remainingGrams", "pricePaid", "purchasedOn", "createdByUserId")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [
      centerId,
      values.material,
      values.color,
      values.brand,
      values.totalGrams,
      values.remainingGrams,
      values.pricePaid,
      values.purchasedOn,
      userId,
    ],
  );
  return res.rows[0].id as string;
}

describeIntegration("integridad de la Fase 2 en PostgreSQL", () => {
  beforeAll(async () => { await db!.connect(); });
  beforeEach(async () => {
    await applyPostgresMigrations(db!);
    await createUser(ids.userA, `a-${randomUUID()}@phase2.test`);
    await createUser(ids.userB, `b-${randomUUID()}@phase2.test`);
    await q("INSERT INTO \"Center\" (id,name,\"updatedAt\") VALUES ($1,'Taller A',now()),($2,'Taller B',now())", [ids.centerA, ids.centerB]);
    await q("INSERT INTO \"Profile\" (id,\"updatedAt\") VALUES ($1,now()),($2,now())", [ids.userA, ids.userB]);
    await q("INSERT INTO \"CenterMember\" (\"centerId\",\"userId\",role,\"updatedAt\") VALUES ($1,$2,'OWNER',now()),($3,$4,'OWNER',now())", [ids.centerA, ids.userA, ids.centerB, ids.userB]);
  });
  afterEach(async () => { await cleanupPostgresFixture(db!, [ids.userA, ids.userB]); });
  afterAll(async () => { await db!.end(); });

  it("no permite mezclar talleres en movimientos de stock ni de bobina", async () => {
    const productB = await insertProduct(ids.centerB, ids.userB, "Pieza B");
    await expect(
      q(
        `INSERT INTO "ProductMovement" ("centerId", "operationId", "productId", kind, delta, "resultingStock", "actorUserId")
         VALUES ($1,$2,$3,'ENTRY',5,5,$4)`,
        [ids.centerA, randomUUID(), productB, ids.userA],
      ),
    ).rejects.toMatchObject({ code: "23503" });

    const spoolB = await insertSpool(ids.centerB, ids.userB);
    await expect(
      q(
        `INSERT INTO "SpoolMovement" ("centerId", "operationId", "spoolId", kind, "deltaGrams", "resultingGrams", "actorUserId")
         VALUES ($1,$2,$3,'CONSUME',-50,950,$4)`,
        [ids.centerA, randomUUID(), spoolB, ids.userA],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("valida materiales, rangos y que ni el stock ni los gramos restantes queden negativos", async () => {
    await expect(insertProduct(ids.centerA, ids.userA, "Invalida", { material: "MADERA" })).rejects.toMatchObject({ code: "23514" });
    await expect(insertProduct(ids.centerA, ids.userA, "Invalida 2", { currentStock: -1 })).rejects.toMatchObject({ code: "23514" });
    await expect(insertProduct(ids.centerA, ids.userA, "Invalida 3", { colorsCount: 0 })).rejects.toMatchObject({ code: "23514" });
    await expect(insertProduct(ids.centerA, ids.userA, "Invalida 4", { category: "   " })).rejects.toMatchObject({ code: "23514" });

    await expect(insertSpool(ids.centerA, ids.userA, { remainingGrams: -10 })).rejects.toMatchObject({ code: "23514" });
    await expect(insertSpool(ids.centerA, ids.userA, { totalGrams: 0 })).rejects.toMatchObject({ code: "23514" });
    await expect(insertSpool(ids.centerA, ids.userA, { color: "  " })).rejects.toMatchObject({ code: "23514" });
    await expect(insertSpool(ids.centerA, ids.userA, { brand: "  " })).rejects.toMatchObject({ code: "23514" });

    const productA = await insertProduct(ids.centerA, ids.userA, "Pieza A");
    await expect(
      q(
        `INSERT INTO "ProductMovement" ("centerId", "operationId", "productId", kind, delta, "resultingStock", "actorUserId")
         VALUES ($1,$2,$3,'EXIT',-1,-1,$4)`,
        [ids.centerA, randomUUID(), productA, ids.userA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      q(
        `INSERT INTO "ProductMovement" ("centerId", "operationId", "productId", kind, delta, "resultingStock", "actorUserId")
         VALUES ($1,$2,$3,'ENTRY',-5,5,$4)`,
        [ids.centerA, randomUUID(), productA, ids.userA],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const spoolA = await insertSpool(ids.centerA, ids.userA);
    await expect(
      q(
        `INSERT INTO "SpoolMovement" ("centerId", "operationId", "spoolId", kind, "deltaGrams", "resultingGrams", "actorUserId")
         VALUES ($1,$2,$3,'CONSUME',-50,-1,$4)`,
        [ids.centerA, randomUUID(), spoolA, ids.userA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      q(
        `INSERT INTO "SpoolMovement" ("centerId", "operationId", "spoolId", kind, "deltaGrams", "resultingGrams", "actorUserId")
         VALUES ($1,$2,$3,'CONSUME',50,950,$4)`,
        [ids.centerA, randomUUID(), spoolA, ids.userA],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("los movimientos de stock y de bobina son inmutables (no se editan ni se borran directamente)", async () => {
    const productA = await insertProduct(ids.centerA, ids.userA, "Pieza A");
    const pmRes = await q(
      `INSERT INTO "ProductMovement" ("centerId", "operationId", "productId", kind, delta, "resultingStock", "actorUserId")
       VALUES ($1,$2,$3,'INITIAL',5,5,$4) RETURNING id`,
      [ids.centerA, randomUUID(), productA, ids.userA],
    );
    const pmId = pmRes.rows[0].id as string;

    await expect(q(`UPDATE "ProductMovement" SET delta = 10 WHERE id = $1`, [pmId])).rejects.toMatchObject({ code: "23514" });
    await expect(q(`DELETE FROM "ProductMovement" WHERE id = $1`, [pmId])).rejects.toMatchObject({ code: "23514" });

    const spoolA = await insertSpool(ids.centerA, ids.userA);
    const smRes = await q(
      `INSERT INTO "SpoolMovement" ("centerId", "operationId", "spoolId", kind, "deltaGrams", "resultingGrams", "actorUserId")
       VALUES ($1,$2,$3,'INITIAL',1000,1000,$4) RETURNING id`,
      [ids.centerA, randomUUID(), spoolA, ids.userA],
    );
    const smId = smRes.rows[0].id as string;

    await expect(q(`UPDATE "SpoolMovement" SET "deltaGrams" = 500 WHERE id = $1`, [smId])).rejects.toMatchObject({ code: "23514" });
    await expect(q(`DELETE FROM "SpoolMovement" WHERE id = $1`, [smId])).rejects.toMatchObject({ code: "23514" });
  });

  it("permite eliminar una pieza solo si no tiene pedidos ni movimientos distintos de INITIAL; nunca permite eliminar bobinas", async () => {
    // 1. Pieza con solo movimiento INITIAL y 0 pedidos -> se puede eliminar
    const unusedWithInitial = await insertProduct(ids.centerA, ids.userA, "Pieza Nueva");
    await q(
      `INSERT INTO "ProductMovement" ("centerId", "operationId", "productId", kind, delta, "resultingStock", "actorUserId")
       VALUES ($1,$2,$3,'INITIAL',3,3,$4)`,
      [ids.centerA, randomUUID(), unusedWithInitial, ids.userA],
    );
    await expect(q(`DELETE FROM "Product" WHERE id = $1`, [unusedWithInitial])).resolves.toBeTruthy();

    // 2. Pieza con movimiento real (ENTRY/EXIT/ADJUST) -> rechaza eliminación
    const usedByMovement = await insertProduct(ids.centerA, ids.userA, "Pieza Fabricada");
    await q(
      `INSERT INTO "ProductMovement" ("centerId", "operationId", "productId", kind, delta, "resultingStock", "actorUserId")
       VALUES ($1,$2,$3,'ENTRY',2,2,$4)`,
      [ids.centerA, randomUUID(), usedByMovement, ids.userA],
    );
    await expect(q(`DELETE FROM "Product" WHERE id = $1`, [usedByMovement])).rejects.toMatchObject({ code: "23514" });

    // 3. Bobina nunca se elimina físicamente (se desactiva)
    const spool = await insertSpool(ids.centerA, ids.userA);
    await expect(q(`DELETE FROM "Spool" WHERE id = $1`, [spool])).rejects.toMatchObject({ code: "23514" });
    await expect(q(`UPDATE "Spool" SET "centerId" = $2 WHERE id = $1`, [spool, ids.centerB])).rejects.toMatchObject({ code: "23514" });
  });
});

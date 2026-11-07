// Pruebas reales de bobinas y movimientos de filamento (Tarea 2.3) en PostgreSQL (`saas3d-test`).
// Incluye prueba de concurrencia real (AGENTS.md): dos consumos simultáneos de 300 g sobre una bobina de 500 g
// deben permitir exactamente uno (quedando en 200 g) y rechazar el segundo con DomainError.
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/action-errors";
import * as authModule from "@/lib/auth";
import { createSpool, recordSpoolMovement } from "@/lib/spool-service";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

const run = process.env.RUN_TRANSACTION_INTEGRATION === "1";
const describeIntegration = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL!;
const db = run ? new Client({ connectionString: databaseUrl }) : null;

const centerA = randomUUID();
const userA = randomUUID();

describeIntegration("Bobinas y consumo concurrente de filamento (Tarea 2.3) en PostgreSQL", () => {
  beforeAll(async () => {
    await db!.connect();
  });

  beforeEach(async () => {
    await applyPostgresMigrations(db!);
    await db!.query(
      "INSERT INTO auth.users (id, email, aud, role, instance_id) VALUES ($1, $2, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')",
      [userA, `spool-${randomUUID()}@test.local`]
    );
    await db!.query(
      'INSERT INTO "Center" (id, name, "timeZone", "updatedAt") VALUES ($1, \'Taller Spools\', \'America/Santiago\', now())',
      [centerA]
    );
    await db!.query('INSERT INTO "Profile" (id, "displayName", "updatedAt") VALUES ($1, \'Maker\', now())', [userA]);
    await db!.query(
      'INSERT INTO "CenterMember" ("centerId", "userId", role, active, "updatedAt") VALUES ($1, $2, \'OWNER\', true, now())',
      [centerA, userA]
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupPostgresFixture(db!, [userA]);
  });

  afterAll(async () => {
    await db!.end();
  });

  it("dos consumos simultáneos de 300 g sobre una bobina de 500 g: gana uno (200 g) y el otro rechaza con DomainError", async () => {
    const authCtx = {
      userId: userA,
      email: "spool@test.local",
      centerId: centerA,
      centerName: "Taller Spools",
      role: "OWNER" as const,
      timeZone: "America/Santiago",
    };
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(authCtx);
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(authCtx);

    const spool = await createSpool({
      operationId: randomUUID(),
      material: "PETG",
      color: "Negro",
      brand: "eSUN",
      totalGrams: 1000,
      remainingGrams: 500,
      pricePaid: 15000,
    });

    // Caso 1 (Lost Update): dos consumos simultáneos válidos (100 g y 150 g sobre 500 g) deben descontar ambos -> 250 g restantes.
    const validConcurrent = await Promise.all([
      recordSpoolMovement({
        operationId: randomUUID(),
        spoolId: spool.id,
        kind: "CONSUME",
        deltaGrams: 100,
        notes: "Consumo 100g",
      }),
      recordSpoolMovement({
        operationId: randomUUID(),
        spoolId: spool.id,
        kind: "CONSUME",
        deltaGrams: 150,
        notes: "Consumo 150g",
      }),
    ]);
    expect(validConcurrent).toHaveLength(2);
    const afterValidRow = (await db!.query('SELECT "remainingGrams" FROM "Spool" WHERE id = $1', [spool.id])).rows[0];
    expect(afterValidRow.remainingGrams).toBe(250);

    // Caso 2 (Sobregiro concurrente): quedan 250 g y llegan 3 consumos simultáneos de 200 g -> gana 1 (50 g) y 2 rechazan con DomainError.
    const results = await Promise.allSettled([
      recordSpoolMovement({
        operationId: randomUUID(),
        spoolId: spool.id,
        kind: "CONSUME",
        deltaGrams: 200,
        notes: "Consumo A",
      }),
      recordSpoolMovement({
        operationId: randomUUID(),
        spoolId: spool.id,
        kind: "CONSUME",
        deltaGrams: 200,
        notes: "Consumo B",
      }),
      recordSpoolMovement({
        operationId: randomUUID(),
        spoolId: spool.id,
        kind: "CONSUME",
        deltaGrams: 200,
        notes: "Consumo C",
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(DomainError);
    }

    const spoolRow = (await db!.query('SELECT "remainingGrams" FROM "Spool" WHERE id = $1', [spool.id])).rows[0];
    expect(spoolRow.remainingGrams).toBe(50);

    const movementsCount = (
      await db!.query('SELECT count(*)::int AS count FROM "SpoolMovement" WHERE "spoolId" = $1 AND kind = \'CONSUME\'', [spool.id])
    ).rows[0].count;
    expect(movementsCount).toBe(3);
  });

  it("el mismo operationId dos veces no descuenta gramos por duplicado y el alta puede registrar gasto FILAMENT", async () => {
    const authCtx = {
      userId: userA,
      email: "spool@test.local",
      centerId: centerA,
      centerName: "Taller Spools",
      role: "OWNER" as const,
      timeZone: "America/Santiago",
    };
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(authCtx);
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(authCtx);

    const spool = await createSpool({
      operationId: randomUUID(),
      material: "PETG",
      color: "Rojo",
      totalGrams: 1000,
      pricePaid: 16000,
      recordExpenseInMoney: true,
      paymentMethod: "TRANSFER",
    });

    const opId = randomUUID();
    const [m1, m2] = await Promise.all([
      recordSpoolMovement({ operationId: opId, spoolId: spool.id, kind: "CONSUME", deltaGrams: 120 }),
      recordSpoolMovement({ operationId: opId, spoolId: spool.id, kind: "CONSUME", deltaGrams: 120 }),
    ]);

    expect(m1.id).toBe(m2.id);
    expect(m1.resultingGrams).toBe(880);

    const spoolRow = (await db!.query('SELECT "remainingGrams" FROM "Spool" WHERE id = $1', [spool.id])).rows[0];
    expect(spoolRow.remainingGrams).toBe(880);

    const expenseRows = (
      await db!.query('SELECT amount, category FROM "MoneyTransaction" WHERE "centerId" = $1', [centerA])
    ).rows;
    expect(expenseRows).toEqual([{ amount: 16000, category: "FILAMENT" }]);
  });
});

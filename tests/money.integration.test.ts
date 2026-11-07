import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getMonthlyMoneyView } from "@/lib/money-queries";
import { recordManualMoneyTransaction, voidManualMoneyTransaction } from "@/lib/money-service";
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
    throw new Error("Las pruebas de dinero requieren PostgreSQL local protegido.");
  }
}

async function createAuthUser(id: string) {
  await db.query(
    "INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')",
    [id, `${id}@money.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Dinero mensual y frontera horaria America/Santiago en PostgreSQL (Tarea 1.8)", () => {
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
      'INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller Dinero\',\'America/Santiago\',now())',
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

  it("el resumen del mes respeta America/Santiago en los bordes del día y excluye anulados", async () => {
    const authModule = await import("@/lib/auth");
    const ctx = {
      userId: userA,
      centerId: centerA,
      role: "OWNER" as const,
      timeZone: "America/Santiago",
    };
    vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue(ctx);
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue(ctx);

    // 2026-11-01 a las 01:30 UTC sigue siendo 2026-10-31 a las 22:30 en America/Santiago (UTC-3).
    // Debe quedar registrado en octubre (2026-10), no en noviembre (2026-11).
    const lateOctoberInSantiago = new Date("2026-11-01T01:30:00.000Z");
    const octTx = await recordManualMoneyTransaction({
      operationId: randomUUID(),
      type: "EXPENSE",
      category: "FILAMENT",
      amount: 15000,
      method: "TRANSFER",
      notes: "Bobina PETG comprada el 31 oct a las 22:30 en Chile",
      now: lateOctoberInSantiago,
    });
    expect(octTx.occurredOn).toBe("2026-10-31");

    // 2026-11-01 a las 03:30 UTC ya es 2026-11-01 a las 00:30 en America/Santiago.
    // Debe quedar registrado en noviembre (2026-11).
    const earlyNovemberInSantiago = new Date("2026-11-01T03:30:00.000Z");
    const novIncome = await recordManualMoneyTransaction({
      operationId: randomUUID(),
      type: "INCOME",
      category: "DIGITAL_SALE",
      amount: 5000,
      method: "OTHER",
      notes: "Archivo STL Cults3D",
      now: earlyNovemberInSantiago,
    });
    expect(novIncome.occurredOn).toBe("2026-11-01");

    // Registrar un gasto en noviembre y luego anularlo
    const novVoidedExpense = await recordManualMoneyTransaction({
      operationId: randomUUID(),
      type: "EXPENSE",
      category: "PARTS",
      amount: 8000,
      method: "CASH",
      occurredOn: "2026-11-02",
      notes: "Boquilla errónea",
    });
    await voidManualMoneyTransaction({
      transactionId: novVoidedExpense.id,
      reason: "Compra cancelada",
    });

    // Consultar octubre usando el instante del borde (2026-11-01T01:30:00Z -> 2026-10 en Santiago)
    const octView = await getMonthlyMoneyView({ now: lateOctoberInSantiago });
    expect(octView.month).toBe("2026-10");
    expect(octView.summary.expense).toBe(15000);
    expect(octView.summary.income).toBe(0);
    expect(octView.summary.profit).toBe(-15000);

    // Consultar noviembre (2026-11): solo cuenta el ingreso de 5000, ni el de octubre ni el anulado
    const novView = await getMonthlyMoneyView({ month: "2026-11" });
    expect(novView.month).toBe("2026-11");
    expect(novView.summary.income).toBe(5000);
    expect(novView.summary.expense).toBe(0);
    expect(novView.summary.profit).toBe(5000);
    expect(novView.transactions).toHaveLength(2);
  });
});

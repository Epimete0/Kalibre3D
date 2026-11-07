import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getCenterSettings, updateCenterSettings } from "@/lib/center-settings-service";
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
    throw new Error("Las pruebas de ajustes requieren PostgreSQL local protegido.");
  }
}

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

async function createAuthUser(id: string) {
  await db.query(
    "INSERT INTO auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data) VALUES ($1,'authenticated','authenticated',$2,'not-used',now(),now(),now(),'{}','{}')",
    [id, `${id}@settings.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Ajustes del taller en PostgreSQL", () => {
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
    await db.query('INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller Test\',\'America/Santiago\',now())', [centerA]);
    await db.query('INSERT INTO "CenterMember" ("centerId","userId",role,"updatedAt") VALUES ($1,$2,\'OWNER\',now())', [centerA, userA]);
  });

  afterEach(async () => {
    await cleanupPostgresFixture(db, [userA]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.end();
  });

  it("leer la configuración de un taller nuevo en paralelo no falla y crea una sola fila (primer ingreso al panel)", async () => {
    // Intercalación real del panel: getDashboardOverview y listSpools llaman a getCenterSettings a la vez.
    // Ambas ven que no hay fila e intentan crearla; la segunda chocaba con CenterSettings_pkey (P2002).
    const authModule = await import("@/lib/auth");
    vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    const results = await Promise.allSettled(Array.from({ length: 8 }, () => getCenterSettings()));
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected.map((result) => String((result as PromiseRejectedResult).reason).slice(0, 120))).toEqual([]);
    for (const result of results) {
      if (result.status === "fulfilled") expect(result.value).toMatchObject({ centerId: centerA, currency: "CLP" });
    }

    const rows = await db.query('SELECT count(*)::int AS n FROM "CenterSettings" WHERE "centerId" = $1', [centerA]);
    expect(rows.rows[0].n).toBe(1);
  });

  it("un taller tiene un solo registro de configuración (PRIMARY KEY centerId)", async () => {
    await db.query(
      'INSERT INTO "CenterSettings" ("centerId",currency,"electricityCostPerHour","mlCommissionPercent","mlDefaultShippingCost","defaultPackagingCost","defaultCostPerKg","defaultPurgeGrams","lowSpoolThresholdGrams") VALUES ($1,\'CLP\',100,19,0,0,15000,0,150)',
      [centerA]
    );

    // Intento de duplicar fila para el mismo taller falla por PK
    await expect(
      db.query(
        'INSERT INTO "CenterSettings" ("centerId",currency,"electricityCostPerHour","mlCommissionPercent","mlDefaultShippingCost","defaultPackagingCost","defaultCostPerKg","defaultPurgeGrams","lowSpoolThresholdGrams") VALUES ($1,\'USD\',100,19,0,0,15000,0,150)',
        [centerA]
      )
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("permite cambiar la moneda cuando no hay movimientos, pero la bloquea si existe alguno", async () => {
    // Inicialmente sin movimientos
    await db.query(
      'INSERT INTO "CenterSettings" ("centerId",currency,"electricityCostPerHour","mlCommissionPercent","mlDefaultShippingCost","defaultPackagingCost","defaultCostPerKg","defaultPurgeGrams","lowSpoolThresholdGrams") VALUES ($1,\'CLP\',150,19,799,250,15000,25,150)',
      [centerA]
    );

    // Contexto mockeado para el servicio apuntando a centerA
    const authModule = await import("@/lib/auth");
    const requireCatalogSpy = vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });
    const requireOperationalSpy = vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    try {
      // 1. Cambiar a USD es exitoso
      await updateCenterSettings(
        form({
          currency: "USD",
          timeZone: "America/Santiago",
          electricityCostPerHour: "200",
          mlCommissionPercent: "19",
          mlDefaultShippingCost: "5",
          defaultPackagingCost: "1",
          defaultCostPerKg: "15",
          defaultPurgeGrams: "20",
          lowSpoolThresholdGrams: "150",
        })
      );

      const row = (await db.query('SELECT currency, "electricityCostPerHour" FROM "CenterSettings" WHERE "centerId"=$1', [centerA])).rows[0];
      expect(row.currency).toBe("USD");
      expect(row.electricityCostPerHour).toBe(200);

      // 2. Insertamos un movimiento de dinero
      await db.query(
        'INSERT INTO "MoneyTransaction" ("centerId","operationId",type,category,amount,"occurredOn",method,"recordedByUserId") VALUES ($1,$2,\'EXPENSE\',\'FILAMENT\',15000,\'2026-11-08\',\'TRANSFER\',$3)',
        [centerA, randomUUID(), userA]
      );

      // 3. Intentar volver a CLP debe fallar por haber movimientos
      await expect(
        updateCenterSettings(
          form({
            currency: "CLP",
            timeZone: "America/Santiago",
            electricityCostPerHour: "200",
            mlCommissionPercent: "19",
            mlDefaultShippingCost: "5",
            defaultPackagingCost: "1",
            defaultCostPerKg: "15",
            defaultPurgeGrams: "20",
            lowSpoolThresholdGrams: "150",
          })
        )
      ).rejects.toThrow("No es posible cambiar la moneda porque el taller ya registra movimientos de dinero.");

      // La moneda en BD sigue siendo USD
      const rowAfter = (await db.query('SELECT currency FROM "CenterSettings" WHERE "centerId"=$1', [centerA])).rows[0];
      expect(rowAfter.currency).toBe("USD");
    } finally {
      requireCatalogSpy.mockRestore();
      requireOperationalSpy.mockRestore();
    }
  });
});

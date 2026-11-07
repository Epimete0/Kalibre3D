import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCustomer, deleteCustomer, setCustomerActive } from "@/lib/customer-service";
import { getCustomerDetail, listCustomers } from "@/lib/customer-queries";
import { applyPostgresMigrations, cleanupPostgresFixture } from "./postgres-test-harness";

const run = process.env.RUN_TRANSACTION_INTEGRATION === "1";
const suite = run ? describe : describe.skip;
const databaseUrl = process.env.SUPABASE_TEST_DATABASE_URL;

let db: Client;
let prisma: PrismaClient;
let userA: string;
let userB: string;
let centerA: string;
let centerB: string;

function localOnly() {
  if (!databaseUrl || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(new URL(databaseUrl).hostname)) {
    throw new Error("Las pruebas de clientes requieren PostgreSQL local protegido.");
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
    [id, `${id}@customers.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Clientes (Customer) en PostgreSQL", () => {
  beforeAll(async () => {
    localOnly();
    db = new Client({ connectionString: databaseUrl });
    await db.connect();
    prisma = new PrismaClient({ adapter: new PrismaPg(db) });
  });

  beforeEach(async () => {
    await applyPostgresMigrations(db);
    userA = randomUUID();
    userB = randomUUID();
    centerA = randomUUID();
    centerB = randomUUID();
    await createAuthUser(userA);
    await createAuthUser(userB);
    await db.query(
      'INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller A\',\'America/Santiago\',now()),($2,\'Taller B\',\'America/Santiago\',now())',
      [centerA, centerB]
    );
    await db.query(
      'INSERT INTO "CenterMember" ("centerId","userId",role,"updatedAt") VALUES ($1,$2,\'OWNER\',now()),($3,$4,\'OWNER\',now())',
      [centerA, userA, centerB, userB]
    );
  });

  afterEach(async () => {
    await cleanupPostgresFixture(db, [userA, userB]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.end();
  });

  it("aislamiento multi-taller y búsqueda insensible a tildes", async () => {
    const authModule = await import("@/lib/auth");
    const authSpy = vi.spyOn(authModule, "requireOperationalContext");
    const userAuthSpy = vi.spyOn(authModule, "requireAuthContext");

    // Crear cliente en Taller A con tildes
    authSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    const custA = await createCustomer(
      form({
        name: "Nicolás Cárcamo",
        phone: "+56912345678",
        instagram: "@nico.3d",
        notes: "Cliente de prueba Taller A",
      })
    );

    // Crear cliente en Taller B
    authSpy.mockResolvedValueOnce({ userId: userB, centerId: centerB, role: "OWNER", timeZone: "America/Santiago" });
    const custB = await createCustomer(
      form({
        name: "Nicolás Cárcamo",
        phone: "+56987654321",
        instagram: "@nico.b",
      })
    );

    expect(custA.id).not.toBe(custB.id);

    // Taller A busca "carcamo" sin tilde: solo ve su cliente
    userAuthSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    const listA = await listCustomers({ search: "carcamo" });
    expect(listA).toHaveLength(1);
    expect(listA[0].id).toBe(custA.id);
    expect(listA[0].phone).toBe("+56912345678");

    // Taller B busca "carcamo": solo ve el de Taller B
    userAuthSpy.mockResolvedValueOnce({ userId: userB, centerId: centerB, role: "OWNER", timeZone: "America/Santiago" });
    const listB = await listCustomers({ search: "carcamo" });
    expect(listB).toHaveLength(1);
    expect(listB[0].id).toBe(custB.id);
    expect(listB[0].phone).toBe("+56987654321");

    // Intentar consultar detalle de cliente de Taller A desde Taller B retorna null
    userAuthSpy.mockResolvedValueOnce({ userId: userB, centerId: centerB, role: "OWNER", timeZone: "America/Santiago" });
    const foreignDetail = await getCustomerDetail(custA.id);
    expect(foreignDetail).toBeNull();
  });

  it("permite eliminar clientes sin ventas y prohíbe eliminar clientes con pedidos", async () => {
    const authModule = await import("@/lib/auth");
    const authSpy = vi.spyOn(authModule, "requireOperationalContext");
    const catalogSpy = vi.spyOn(authModule, "requireCatalogContext");

    // 1. Cliente nuevo sin ventas
    authSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    const customer = await createCustomer(form({ name: "Cliente Sin Pedidos" }));

    // Eliminarlo físicamente debe permitirse
    catalogSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    await deleteCustomer(customer.id);

    const check = await db.query('SELECT count(*)::int as count FROM "Customer" WHERE id = $1', [customer.id]);
    expect(check.rows[0].count).toBe(0);

    // 2. Cliente con pedido asociado
    authSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    const customerWithOrder = await createCustomer(form({ name: "Cliente Con Historial" }));

    const orderId = randomUUID();
    const opId = randomUUID();
    await db.query(
      `INSERT INTO "Order" (
        id, "centerId", number, "operationId", kind, "customerId", channel, status, version,
        discount, total, "mlCommission", "mlShippingCost", "createdByUserId", "updatedAt", "deliveredAt"
      ) VALUES (
        $1, $2, 1, $3, 'QUICK_SALE', $4, 'WHATSAPP', 'DELIVERED', 1,
        0, 15000, 0, 0, $5, now(), now()
      )`,
      [orderId, centerA, opId, customerWithOrder.id, userA]
    );

    // Intentar borrarlo debe ser rechazado
    catalogSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    await expect(deleteCustomer(customerWithOrder.id)).rejects.toThrow(
      "No se puede eliminar el cliente porque ya tiene pedidos registrados. Puedes desactivarlo para ocultarlo."
    );

    // El cliente debe permanecer intacto
    const stillExists = await db.query('SELECT count(*)::int as count FROM "Customer" WHERE id = $1', [
      customerWithOrder.id,
    ]);
    expect(stillExists.rows[0].count).toBe(1);

    // Desactivarlo sí está permitido
    authSpy.mockResolvedValueOnce({ userId: userA, centerId: centerA, role: "OWNER", timeZone: "America/Santiago" });
    await setCustomerActive(customerWithOrder.id, false);

    const activeCheck = await db.query('SELECT active FROM "Customer" WHERE id = $1', [customerWithOrder.id]);
    expect(activeCheck.rows[0].active).toBe(false);
  });
});

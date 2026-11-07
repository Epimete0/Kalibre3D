import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/action-errors";
import { createProduct, deleteProduct, recordProductMovement, setProductActive } from "@/lib/product-service";
import { listProducts } from "@/lib/product-queries";
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
    throw new Error("Las pruebas de productos requieren PostgreSQL local protegido.");
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
    [id, `${id}@products.test`]
  );
  await db.query('INSERT INTO "Profile" (id,"updatedAt") VALUES ($1,now())', [id]);
}

suite("Lista de precios (Product) en PostgreSQL", () => {
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
    await db.query('INSERT INTO "Center" (id,name,"timeZone","updatedAt") VALUES ($1,\'Taller A\',\'America/Santiago\',now()),($2,\'Taller B\',\'America/Santiago\',now())', [centerA, centerB]);
    await db.query('INSERT INTO "CenterMember" ("centerId","userId",role,"updatedAt") VALUES ($1,$2,\'OWNER\',now()),($3,$4,\'OWNER\',now())', [centerA, userA, centerB, userB]);
  });

  afterEach(async () => {
    await cleanupPostgresFixture(db, [userA, userB]);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await db?.end();
  });

  it("el nombre de la pieza no se repite dentro del taller (insensible a mayúsculas y espacios) pero sí en otro taller", async () => {
    const authModule = await import("@/lib/auth");
    const spy = vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    try {
      await createProduct(form({ name: "Emblema Hilux", salePrice: "8990", mlPrice: "10990" }));

      // Mismo taller con variación de mayúsculas/espacios se rechaza
      await expect(
        createProduct(form({ name: "  emblema hilux  ", salePrice: "9000" }))
      ).rejects.toThrow("Ya existe una pieza con ese nombre.");

      // En Taller B con userB, el mismo nombre sí se permite
      spy.mockResolvedValueOnce({
        userId: userB,
        centerId: centerB,
        role: "OWNER",
        timeZone: "America/Santiago",
      });
      await expect(
        createProduct(form({ name: "Emblema Hilux", salePrice: "8990" }))
      ).resolves.toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it("permite eliminar físicamente una pieza sin pedidos, pero bloquea si tiene ventas históricas", async () => {
    const authModule = await import("@/lib/auth");
    const catalogSpy = vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });
    const operationalSpy = vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    try {
      // 1. Crear pieza 1 (sin pedidos)
      const p1 = await createProduct(form({ name: "Llavero Borrable", salePrice: "1500" }));
      expect(p1.id).toBeDefined();

      // Debe aparecer en el listado con hasOrders = false
      const listBefore = await listProducts();
      expect(listBefore.find((p) => p.id === p1.id)?.hasOrders).toBe(false);

      // Eliminar físicamente p1
      await deleteProduct(form({ id: p1.id }));
      const checkP1 = await db.query('SELECT count(*) FROM "Product" WHERE id=$1', [p1.id]);
      expect(Number(checkP1.rows[0].count)).toBe(0);

      // 2. Crear pieza 2 y vincularla a un pedido
      const p2 = await createProduct(form({ name: "Emblema Con Venta", salePrice: "8990" }));
      const orderResult = await db.query(
        'INSERT INTO "Order" ("centerId",number,"operationId",kind,channel,status,"deliveredAt","createdByUserId") VALUES ($1,1,$2,\'ORDER\',\'WHATSAPP\',\'DELIVERED\',now(),$3) RETURNING id',
        [centerA, randomUUID(), userA]
      );
      const orderId = orderResult.rows[0].id;
      await db.query(
        'INSERT INTO "OrderItem" ("centerId","orderId",position,"productId",description,qty,"unitPrice") VALUES ($1,$2,0,$3,\'Emblema Con Venta\',1,8990)',
        [centerA, orderId, p2.id]
      );

      // Debe aparecer con hasOrders = true
      const listWithOrder = await listProducts();
      expect(listWithOrder.find((p) => p.id === p2.id)?.hasOrders).toBe(true);

      // Intentar eliminar p2 es rechazado por el servicio
      await expect(deleteProduct(form({ id: p2.id }))).rejects.toThrow(
        "No se puede eliminar la pieza porque ya tiene pedidos registrados. Puedes desactivarla para ocultarla."
      );

      // El trigger Product_delete_guard y la clave foránea de PostgreSQL la protegen físicamente
      await expect(db.query('DELETE FROM "Product" WHERE id=$1', [p2.id])).rejects.toMatchObject({
        code: "23514",
      });

      // Pero sí se puede desactivar para que no aparezca en nuevas ventas
      await setProductActive(form({ id: p2.id, active: "false" }));
      const activeList = await listProducts({ includeInactive: false });
      expect(activeList.find((p) => p.id === p2.id)).toBeUndefined();

      const allList = await listProducts({ includeInactive: true });
      expect(allList.find((p) => p.id === p2.id)?.active).toBe(false);
    } finally {
      catalogSpy.mockRestore();
      operationalSpy.mockRestore();
    }
  });

  it("stock concurrente de piezas (D15): tres salidas simultáneas de 6 unidades con stock 10 solo permiten una (quedan 4) y rechazan las otras dos con DomainError", async () => {
    const authModule = await import("@/lib/auth");
    const catalogSpy = vi.spyOn(authModule, "requireCatalogContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });
    const operationalSpy = vi.spyOn(authModule, "requireOperationalContext").mockResolvedValue({
      userId: userA,
      centerId: centerA,
      role: "OWNER",
      timeZone: "America/Santiago",
    });

    try {
      const p = await createProduct(
        form({
          name: "Emblema Stock Concurrente",
          salePrice: "8990",
          initialStock: "10",
          minStock: "2",
        })
      );

      const results = await Promise.allSettled([
        recordProductMovement({
          operationId: randomUUID(),
          productId: p.id,
          kind: "EXIT",
          delta: 6,
          notes: "Salida 1",
        }),
        recordProductMovement({
          operationId: randomUUID(),
          productId: p.id,
          kind: "EXIT",
          delta: 6,
          notes: "Salida 2",
        }),
        recordProductMovement({
          operationId: randomUUID(),
          productId: p.id,
          kind: "EXIT",
          delta: 6,
          notes: "Salida 3",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(DomainError);
      }

      const row = (await db.query('SELECT "currentStock" FROM "Product" WHERE id = $1', [p.id])).rows[0];
      expect(row.currentStock).toBe(4);
    } finally {
      catalogSpy.mockRestore();
      operationalSpy.mockRestore();
    }
  });
});

// Semilla de datos de demostración para saas3d-local (Tarea 1.9).
// NUNCA toca la nube: exige loopback (127.0.0.1 / localhost) y puerto local 54442.
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { assertLoopbackPostgresUrl } from "./local-postgres";

function readDevDbUrl(): string {
  const output = execSync("npx supabase status -o env --workdir supabase-local", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const env = Object.fromEntries(
    output.split(/\r?\n/).flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    })
  );
  return env.DB_URL ?? "";
}

async function main() {
  const databaseUrl = readDevDbUrl();
  assertLoopbackPostgresUrl(databaseUrl);

  const parsedUrl = new URL(databaseUrl);
  if (parsedUrl.port !== "54442") {
    throw new Error(
      `[local:demo] Por seguridad solo se permite sembrar en saas3d-local (puerto 54442). Recibido: ${parsedUrl.port}`
    );
  }

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    await db.query("BEGIN");

    // 1. Asegurar usuario QA en auth.users y Profile
    const existingUsers = await db.query<{ id: string; email: string }>(
      "SELECT id, email FROM auth.users ORDER BY created_at ASC"
    );

    let ownerId: string;
    if (existingUsers.rows.length > 0) {
      ownerId = existingUsers.rows[0].id;
    } else {
      ownerId = "00000000-0000-4000-8000-000000000001";
      await db.query(
        `INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
         VALUES ($1, 'authenticated', 'authenticated', 'qa@taller3d.local', 'not-used', now(), now(), now(), '{}', '{}')
         ON CONFLICT (id) DO NOTHING`,
        [ownerId]
      );
    }

    await db.query(
      `INSERT INTO "Profile" (id, "displayName", "updatedAt")
       VALUES ($1, 'Surko Maker', now())
       ON CONFLICT (id) DO UPDATE SET "displayName" = COALESCE("Profile"."displayName", 'Surko Maker')`,
      [ownerId]
    );

    // 2. Recrear "Taller QA" de forma limpia e idempotente
    const existingCenter = await db.query<{ id: string }>(
      `SELECT id FROM "Center" WHERE name = 'Taller QA' LIMIT 1`
    );
    if (existingCenter.rows[0]) {
      const oldCenterId = existingCenter.rows[0].id;
      await db.query(`DELETE FROM "MoneyTransaction" WHERE "centerId" = $1`, [oldCenterId]).catch(() => {});
      // Como OrderEvent y MoneyTransaction tienen triggers de inmutabilidad en filas individuales,
      // eliminar el Center en cascada o recrear con nuevo ID si tiene triggers:
    }

    const centerId = "00000000-0000-4000-8000-000000000100";
    const alreadySeeded = await db.query<{ id: string }>(
      `SELECT id FROM "Center" WHERE id = $1`,
      [centerId]
    );

    if (alreadySeeded.rows.length > 0) {
      console.log("[local:demo] 'Taller QA' ya existe en saas3d-local. Asegurando membresías...");
      for (const u of existingUsers.rows) {
        await db.query(
          `INSERT INTO "Profile" (id, "displayName", "updatedAt") VALUES ($1, 'Surko Maker', now()) ON CONFLICT (id) DO NOTHING`,
          [u.id]
        );
        await db.query(
          `INSERT INTO "CenterMember" ("centerId", "userId", role, active, "updatedAt")
           VALUES ($1, $2, 'OWNER', true, now())
           ON CONFLICT ("centerId", "userId") DO UPDATE SET active = true, role = 'OWNER'`,
          [centerId, u.id]
        );
      }
      await db.query("COMMIT");
      console.log("[local:demo] Listo. Taller QA disponible para todas las cuentas locales.");
      return;
    }

    await db.query(
      `INSERT INTO "Center" (id, name, "timeZone", active, "updatedAt")
       VALUES ($1, 'Taller QA', 'America/Santiago', true, now())`,
      [centerId]
    );

    // Asociar todos los usuarios locales existentes como OWNER de Taller QA
    const allUserIds = Array.from(new Set([ownerId, ...existingUsers.rows.map((r) => r.id)]));
    for (const uid of allUserIds) {
      await db.query(
        `INSERT INTO "Profile" (id, "displayName", "updatedAt") VALUES ($1, 'Surko Maker', now()) ON CONFLICT (id) DO NOTHING`,
        [uid]
      );
      await db.query(
        `INSERT INTO "CenterMember" ("centerId", "userId", role, active, "updatedAt")
         VALUES ($1, $2, 'OWNER', true, now())`,
        [centerId, uid]
      );
    }

    // 3. Ajustes del taller (CLP, 19% ML, envío $799, $15.000/kg)
    await db.query(
      `INSERT INTO "CenterSettings" ("centerId", currency, "electricityCostPerHour", "mlCommissionPercent", "mlDefaultShippingCost", "defaultPackagingCost", "defaultCostPerKg", "defaultPurgeGrams", "lowSpoolThresholdGrams", "updatedAt")
       VALUES ($1, 'CLP', 150, 19.00, 799, 200, 15000, 15, 150, now())`,
      [centerId]
    );

    // 4. Lista de precios mínima (Product)
    const prodHilux = randomUUID();
    const prodRaptor = randomUUID();
    const prodSoporte = randomUUID();

    await db.query(
      `INSERT INTO "Product" (id, "centerId", name, "salePrice", "mlPrice", active, "createdByUserId", "updatedAt")
       VALUES
         ($1, $4, 'Emblema Hilux TRD', 7500, 8990, true, $5, now()),
         ($2, $4, 'Emblema Ranger Raptor', 8500, 9990, true, $5, now()),
         ($3, $4, 'Soporte Pared Control PS5', 5000, 6990, true, $5, now())`,
      [prodHilux, prodRaptor, prodSoporte, centerId, ownerId]
    );

    // 5. Clientes
    const custAndres = randomUUID();
    const custCamila = randomUUID();
    const custRoberto = randomUUID();

    await db.query(
      `INSERT INTO "Customer" (id, "centerId", name, phone, instagram, notes, active, "createdByUserId", "updatedAt")
       VALUES
         ($1, $4, 'Andrés Cárcamo', '+56991112233', 'andres_4x4', 'Cliente frecuente de emblemas', true, $5, now()),
         ($2, $4, 'Camila Muñoz', '+56984445566', 'cami.maker', 'Retira en persona en Talca', true, $5, now()),
         ($3, $4, 'Roberto Silva', '+56977778899', null, null, true, $5, now())`,
      [custAndres, custCamila, custRoberto, centerId, ownerId]
    );

    const today = new Date();
    const fmtDate = (offsetDays: number) => {
      const d = new Date(today.getTime() + offsetDays * 86_400_000);
      return d.toISOString().slice(0, 10);
    };

    // 6. Pedidos en todos los estados
    // Pedido #1: Venta ML entregada de $8.990 con 19% ($1.708) y envío $799 -> neto $6.483
    const ord1 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 1, $3, 'QUICK_SALE', $4, 'MERCADOLIBRE', 'DELIVERED', 1, $5, 0, 8990, 'ML-2000991122', 1708, 799, 'Envío Chilexpress convenio ML', $6, now(), now())`,
      [ord1, centerId, randomUUID(), custAndres, fmtDate(-3), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, $4, 'Emblema Hilux TRD', 1, 8990, 'PETG', 50, 2)`,
      [randomUUID(), centerId, ord1, prodHilux]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES ($1, $2, $3, 1, null, 'DELIVERED', $4)`,
      [randomUUID(), centerId, ord1, ownerId]
    );
    await db.query(
      `INSERT INTO "MoneyTransaction" (id, "centerId", "operationId", type, category, amount, "occurredOn", method, "orderId", notes, "recordedByUserId")
       VALUES ($1, $2, $3, 'INCOME', 'ORDER_PAYMENT', 6483, $4, 'MERCADOLIBRE', $5, 'Neto liquidado por Mercado Libre ($8.990 - $1.708 - $799)', $6)`,
      [randomUUID(), centerId, randomUUID(), fmtDate(-3), ord1, ownerId]
    );

    // Pedido #2: Devolución de Mercado Libre (RETURNED)
    const ord2 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 2, $3, 'QUICK_SALE', null, 'MERCADOLIBRE', 'RETURNED', 2, $4, 0, 8990, 'ML-2000884411', 1708, 799, 'Comprador se equivocó de modelo de camioneta', $5, now(), now())`,
      [ord2, centerId, randomUUID(), fmtDate(-5), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, $4, 'Emblema Hilux TRD', 1, 8990, 'PETG', 50, 2)`,
      [randomUUID(), centerId, ord2, prodHilux]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES
         ($1, $3, $4, 1, null, 'DELIVERED', $5),
         ($2, $3, $4, 2, 'DELIVERED', 'RETURNED', $5)`,
      [randomUUID(), randomUUID(), centerId, ord2, ownerId]
    );
    await db.query(
      `INSERT INTO "MoneyTransaction" (id, "centerId", "operationId", type, category, amount, "occurredOn", method, "orderId", notes, "recordedByUserId")
       VALUES
         ($1, $3, $4, 'INCOME', 'ORDER_PAYMENT', 6483, $6, 'MERCADOLIBRE', $7, 'Cobro inicial ML', $8),
         ($2, $3, $5, 'EXPENSE', 'REFUNDS', 6483, $6, 'MERCADOLIBRE', $7, 'Reembolso por devolución ML', $8)`,
      [randomUUID(), randomUUID(), centerId, randomUUID(), randomUUID(), fmtDate(-4), ord2, ownerId]
    );

    // Pedido #3: Imprimiendo y ATRASADO (WhatsApp)
    const ord3 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 3, $3, 'ORDER', $4, 'WHATSAPP', 'PRINTING', 2, $5, 0, 8500, null, 0, 0, 'Letras rojas con fondo negro mate', $6, null, now())`,
      [ord3, centerId, randomUUID(), custAndres, fmtDate(-2), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, $4, 'Emblema Ranger Raptor', 1, 8500, 'PETG', 65, 2)`,
      [randomUUID(), centerId, ord3, prodRaptor]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES
         ($1, $3, $4, 1, null, 'CONFIRMED', $5),
         ($2, $3, $4, 2, 'CONFIRMED', 'PRINTING', $5)`,
      [randomUUID(), randomUUID(), centerId, ord3, ownerId]
    );
    await db.query(
      `INSERT INTO "MoneyTransaction" (id, "centerId", "operationId", type, category, amount, "occurredOn", method, "orderId", notes, "recordedByUserId")
       VALUES ($1, $2, $3, 'INCOME', 'ORDER_PAYMENT', 4000, $4, 'TRANSFER', $5, 'Abono 50% por transferencia', $6)`,
      [randomUUID(), centerId, randomUUID(), fmtDate(-3), ord3, ownerId]
    );

    // Pedido #4: Listo para entregar (READY, Instagram)
    const ord4 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 4, $3, 'ORDER', $4, 'INSTAGRAM', 'READY', 3, $5, 0, 10000, null, 0, 0, '2 soportes blancos', $6, null, now())`,
      [ord4, centerId, randomUUID(), custCamila, fmtDate(1), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, $4, 'Soporte Pared Control PS5', 2, 5000, 'PETG', 45, 1)`,
      [randomUUID(), centerId, ord4, prodSoporte]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES
         ($1, $4, $5, 1, null, 'CONFIRMED', $6),
         ($2, $4, $5, 2, 'CONFIRMED', 'PRINTING', $6),
         ($3, $4, $5, 3, 'PRINTING', 'READY', $6)`,
      [randomUUID(), randomUUID(), randomUUID(), centerId, ord4, ownerId]
    );

    // Pedido #5: Confirmado (CONFIRMED, WhatsApp)
    const ord5 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 5, $3, 'ORDER', $4, 'WHATSAPP', 'CONFIRMED', 1, $5, 500, 14500, null, 0, 0, null, $6, null, now())`,
      [ord5, centerId, randomUUID(), custRoberto, fmtDate(3), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, $4, 'Emblema Hilux TRD', 2, 7500, 'PETG', 50, 3)`,
      [randomUUID(), centerId, ord5, prodHilux]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES ($1, $2, $3, 1, null, 'CONFIRMED', $4)`,
      [randomUUID(), centerId, ord5, ownerId]
    );

    // Pedido #6: Cotizado (QUOTED, Instagram)
    const ord6 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 6, $3, 'ORDER', $4, 'INSTAGRAM', 'QUOTED', 1, $5, 0, 12000, null, 0, 0, 'Cotización emblema personalizado 4 colores', $6, null, now())`,
      [ord6, centerId, randomUUID(), custCamila, fmtDate(5), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, null, 'Emblema personalizado 4x4', 1, 12000, 'PETG', 60, 4)`,
      [randomUUID(), centerId, ord6]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES ($1, $2, $3, 1, null, 'QUOTED', $4)`,
      [randomUUID(), centerId, ord6, ownerId]
    );

    // Pedido #7: Cancelado (CANCELED, En persona)
    const ord7 = randomUUID();
    await db.query(
      `INSERT INTO "Order" (id, "centerId", number, "operationId", kind, "customerId", channel, status, version, "dueDate", discount, total, "mlOrderRef", "mlCommission", "mlShippingCost", notes, "createdByUserId", "deliveredAt", "updatedAt")
       VALUES ($1, $2, 7, $3, 'ORDER', null, 'IN_PERSON', 'CANCELED', 2, null, 0, 5000, null, 0, 0, 'Cliente desistió antes de imprimir', $4, null, now())`,
      [ord7, centerId, randomUUID(), ownerId]
    );
    await db.query(
      `INSERT INTO "OrderItem" (id, "centerId", "orderId", position, "productId", description, qty, "unitPrice", material, grams, "colorsCount")
       VALUES ($1, $2, $3, 1, $4, 'Soporte Pared Control PS5', 1, 5000, 'PETG', 45, 1)`,
      [randomUUID(), centerId, ord7, prodSoporte]
    );
    await db.query(
      `INSERT INTO "OrderEvent" (id, "centerId", "orderId", version, "fromStatus", "toStatus", "actorUserId")
       VALUES
         ($1, $3, $4, 1, null, 'QUOTED', $5),
         ($2, $3, $4, 2, 'QUOTED', 'CANCELED', $5)`,
      [randomUUID(), randomUUID(), centerId, ord7, ownerId]
    );

    // 7. Gastos de filamento y venta de archivo digital Cults3D
    await db.query(
      `INSERT INTO "MoneyTransaction" (id, "centerId", "operationId", type, category, amount, "occurredOn", method, "orderId", notes, "recordedByUserId")
       VALUES
         ($1, $3, $4, 'EXPENSE', 'FILAMENT', 15000, $6, 'TRANSFER', null, '1 kg PETG Negro Anycubic', $7),
         ($2, $3, $5, 'INCOME', 'DIGITAL_SALE', 4500, $6, 'OTHER', null, 'Venta archivo 3D en Cults3D', $7)`,
      [randomUUID(), randomUUID(), centerId, randomUUID(), randomUUID(), fmtDate(-1), ownerId]
    );

    await db.query("COMMIT");
    console.log(
      "[local:demo] 'Taller QA' creado en saas3d-local con clientes, 7 pedidos en todos los estados, ML $8.990 -> neto $6.483, devolución, gasto de filamento y venta Cults3D."
    );
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

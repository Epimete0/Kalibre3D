# Aplicar la migración del costo por venta en producción

Migración: `20261111000000_order_item_unit_cost`
Paquete: `scripts/production/20261111-apply-order-item-unit-cost.sql`

## Qué cambia

Agrega a `OrderItem` la columna **opcional** `unitCost`, el costo unitario estimado guardado al vender, junto con un CHECK de rango. No modifica datos existentes, políticas RLS, grants ni funciones. Las ventas anteriores quedan con `unitCost` vacío, y la pantalla de Rentabilidad las estima con los costos actuales.

## Orden obligatorio

1. **Primero la base de datos.** El código nuevo escribe y lee esta columna: si se despliega antes, crear ventas y ver la rentabilidad fallaría.
2. **Después el código**, con `git push` a `main`.

## Pasos

1. Abre Supabase → proyecto **Saas3D** (`umgxxtpekcjknhclojzo`) → **SQL Editor** → **New query**.
2. Pega el contenido completo de `scripts/production/20261111-apply-order-item-unit-cost.sql` y presiona **Run**.
3. Debe terminar sin errores ("Success"). Para confirmarlo, ejecuta:
   ```sql
   select migration_name, finished_at is not null as ok from public."_prisma_migrations" order by migration_name;
   ```
   Debe aparecer `20261111000000_order_item_unit_cost` con `ok = true`.
4. Si aparece `ya está registrada`, ya estaba aplicada: no se cambió nada.
5. Después, sube el código.

Requiere que antes esté aplicada `20261110000000_guided_setup_costs`; el paquete lo verifica. Se probó en la base local `saas3d-local`: aplica bien, al reintentarlo se detiene sin cambios y `prisma migrate` lo reconoce.

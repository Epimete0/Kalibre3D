-- Kalibre (saas3d) · Producción · Migración 20261111000000_order_item_unit_cost (rentabilidad por pieza).
-- Qué hace: agrega la columna opcional "unitCost" a public."OrderItem" y un CHECK de rango.
-- No modifica datos existentes, políticas RLS, grants ni funciones. Las ventas anteriores quedan con unitCost NULL
-- y la app las estima con los costos actuales.
-- Cómo usar: Supabase → SQL Editor → pegar este archivo completo → Run. Es seguro reintentarlo: si la migración ya
-- está registrada, se detiene sin cambiar nada. Aplicar ANTES de desplegar el código que usa esta columna.
-- SHA-256 (LF) de migration.sql: ab54362dec08cb9ef04ff0b48a4184413db8564131ac693576807aee1741eab3

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $preflight$
DECLARE
  previous text[] := ARRAY[
    '20261107000000_core_multitenant',
    '20261108000000_phase1_orders_money',
    '20261108000100_fix_money_void_check',
    '20261109000000_phase2_catalog_spools_stock',
    '20261110000000_guided_setup_costs'
  ];
  missing text[];
  unfinished text[];
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NULL OR to_regclass('public."OrderItem"') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT: falta el esquema de Kalibre. Aplicar primero los paquetes anteriores.';
  END IF;

  SELECT coalesce(array_agg(name), '{}') INTO missing
    FROM unnest(previous) AS name
   WHERE NOT EXISTS (
     SELECT 1 FROM public."_prisma_migrations" m
      WHERE m.migration_name = name AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL
   );
  IF cardinality(missing) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: faltan migraciones previas: %.', missing;
  END IF;

  SELECT coalesce(array_agg(migration_name), '{}') INTO unfinished
    FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF cardinality(unfinished) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: hay migraciones sin terminar: %.', unfinished;
  END IF;

  IF EXISTS (SELECT 1 FROM public."_prisma_migrations" WHERE migration_name = '20261111000000_order_item_unit_cost') THEN
    RAISE EXCEPTION 'PREFLIGHT: la migración 20261111000000_order_item_unit_cost ya está registrada. No hay nada que aplicar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'unitCost'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT: OrderItem ya tiene la columna unitCost sin estar registrada. Revisar manualmente.';
  END IF;
END
$preflight$;

-- ============================================================
-- 20261111000000_order_item_unit_cost
-- ============================================================
-- Rentabilidad por pieza: costo unitario estimado de cada línea de venta, guardado al momento de vender
-- (filamento + purga + luz + embalaje con los costos del taller de ese día). NULL = no se pudo calcular
-- (venta escrita a mano sin gramos, o líneas anteriores a esta migración, que se estiman con costos actuales).
-- Solo agrega una columna opcional y su CHECK: no cambia datos existentes ni políticas RLS.
ALTER TABLE public."OrderItem"
  ADD COLUMN "unitCost" INTEGER;

ALTER TABLE public."OrderItem"
  ADD CONSTRAINT "OrderItem_unit_cost_check" CHECK ("unitCost" IS NULL OR ("unitCost" >= 0 AND "unitCost" <= 1000000000));

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, 'ab54362dec08cb9ef04ff0b48a4184413db8564131ac693576807aee1741eab3', now(), '20261111000000_order_item_unit_cost', NULL, now(), 1);

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'OrderItem' AND column_name = 'unitCost' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'VERIFY: falta la columna opcional OrderItem.unitCost.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderItem_unit_cost_check') THEN
    RAISE EXCEPTION 'VERIFY: falta el CHECK OrderItem_unit_cost_check.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."OrderItem"'::regclass) THEN
    RAISE EXCEPTION 'VERIFY: OrderItem debe seguir con RLS activo.';
  END IF;
  RAISE NOTICE 'VERIFY OK: columna, CHECK, RLS y registro de la migración 20261111000000_order_item_unit_cost.';
END
$verify$;

COMMIT;

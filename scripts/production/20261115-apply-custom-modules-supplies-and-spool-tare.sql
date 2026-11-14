-- Kalibre (saas3d) · Producción · Migración 20261115000000_custom_modules_supplies_and_spool_tare.
-- Qué hace: agrega módulos opcionales a public."CenterSettings", suppliesCost a public."Product" y tareGrams a public."Spool".
-- No modifica datos existentes, políticas RLS, grants ni funciones.
-- Cómo usar: Supabase → SQL Editor → pegar este archivo completo → Run. Es seguro reintentarlo: si la migración ya
-- está registrada, se detiene sin cambiar nada. Aplicar ANTES de desplegar el código que usa estas columnas.
-- SHA-256 (LF) de migration.sql: 9564f5ab733f670f3e93f10d1140d9cf6f1a330477e3dc33b0d9ddc014b40428

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $preflight$
DECLARE
  previous text[] := ARRAY[
    '20261107000000_core_multitenant',
    '20261108000000_phase1_orders_money',
    '20261108000100_fix_money_void_check',
    '20261109000000_phase2_catalog_spools_stock',
    '20261110000000_guided_setup_costs',
    '20261111000000_order_item_unit_cost',
    '20261114000000_machine_wear_and_failures'
  ];
  missing text[];
  unfinished text[];
  cols text[] := ARRAY[
    'enableSpools',
    'enableClients',
    'enableProductStock'
  ];
  existing_cols text[];
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NULL OR to_regclass('public."CenterSettings"') IS NULL THEN
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

  IF EXISTS (SELECT 1 FROM public."_prisma_migrations" WHERE migration_name = '20261115000000_custom_modules_supplies_and_spool_tare') THEN
    RAISE EXCEPTION 'PREFLIGHT: la migración 20261115000000_custom_modules_supplies_and_spool_tare ya está registrada. No hay nada que aplicar.';
  END IF;

  SELECT coalesce(array_agg(column_name), '{}') INTO existing_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'CenterSettings' AND column_name = ANY (cols);
  IF cardinality(existing_cols) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: CenterSettings ya tiene columnas sin estar registradas: %.', existing_cols;
  END IF;
END
$preflight$;

-- ============================================================
-- 20261115000000_custom_modules_supplies_and_spool_tare
-- ============================================================
-- Módulos opcionales por taller (bobinas, clientes, stock de piezas), insumos extra por pieza y tara de bobina.
-- Todo aditivo con valores por defecto seguros; no cambia políticas RLS ni datos existentes.
ALTER TABLE public."CenterSettings"
  ADD COLUMN "enableSpools" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "enableClients" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "enableProductStock" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."Product"
  ADD COLUMN "suppliesCost" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."Product"
  ADD CONSTRAINT "Product_suppliesCost_non_negative"
    CHECK ("suppliesCost" >= 0);

ALTER TABLE public."Spool"
  ADD COLUMN "tareGrams" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."Spool"
  ADD CONSTRAINT "Spool_tareGrams_non_negative"
    CHECK ("tareGrams" >= 0 AND "tareGrams" <= 10000);

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '9564f5ab733f670f3e93f10d1140d9cf6f1a330477e3dc33b0d9ddc014b40428', now(), '20261115000000_custom_modules_supplies_and_spool_tare', NULL, now(), 1);

DO $verify$
DECLARE
  cols text[] := ARRAY[
    'enableSpools',
    'enableClients',
    'enableProductStock'
  ];
  found_count int;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'CenterSettings' AND column_name = ANY (cols);
  IF found_count <> 3 THEN
    RAISE EXCEPTION 'VERIFY: faltan columnas en CenterSettings (% de 3).', found_count;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_suppliesCost_non_negative') THEN
    RAISE EXCEPTION 'VERIFY: falta el CHECK Product_suppliesCost_non_negative.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Spool_tareGrams_non_negative') THEN
    RAISE EXCEPTION 'VERIFY: falta el CHECK Spool_tareGrams_non_negative.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."CenterSettings"'::regclass) THEN
    RAISE EXCEPTION 'VERIFY: CenterSettings debe seguir con RLS activo.';
  END IF;
  RAISE NOTICE 'VERIFY OK: columnas, CHECK, RLS y registro de la migración 20261115000000_custom_modules_supplies_and_spool_tare.';
END
$verify$;

COMMIT;

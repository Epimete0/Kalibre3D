-- Kalibre (saas3d) · Producción · Migración 20261114000000_machine_wear_and_failures (desgaste y margen de fallos).
-- Qué hace: agrega 4 columnas opcionales (DEFAULT 0) a public."CenterSettings" y un CHECK no-negativo.
-- No modifica datos existentes, políticas RLS, grants ni funciones.
-- Cómo usar: Supabase → SQL Editor → pegar este archivo completo → Run. Es seguro reintentarlo: si la migración ya
-- está registrada, se detiene sin cambiar nada. Aplicar ANTES de desplegar el código que usa estas columnas.
-- SHA-256 (LF) de migration.sql: 1605757fa3df2f6484669b92223ce3d80db782b28a75e08074ba8ec2bfc9e7e3

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $preflight$
DECLARE
  previous text[] := ARRAY[
    '20261107000000_core_multitenant',
    '20261108000000_phase1_orders_money',
    '20261108000100_fix_money_void_check',
    '20261109000000_phase2_catalog_spools_stock',
    '20261110000000_guided_setup_costs',
    '20261111000000_order_item_unit_cost'
  ];
  missing text[];
  unfinished text[];
  cols text[] := ARRAY[
    'machineReplacementCost',
    'machineLifeHours',
    'machineWearCostPerHour',
    'failurePercent'
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

  IF EXISTS (SELECT 1 FROM public."_prisma_migrations" WHERE migration_name = '20261114000000_machine_wear_and_failures') THEN
    RAISE EXCEPTION 'PREFLIGHT: la migración 20261114000000_machine_wear_and_failures ya está registrada. No hay nada que aplicar.';
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
-- 20261114000000_machine_wear_and_failures
-- ============================================================
-- Desgaste de impresora y margen de fallos en ajustes del taller (todo opcional, default 0).
-- No cambia políticas RLS ni datos existentes.
ALTER TABLE public."CenterSettings"
  ADD COLUMN "machineReplacementCost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "machineLifeHours" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "machineWearCostPerHour" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failurePercent" DECIMAL(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public."CenterSettings"
  ADD CONSTRAINT "CenterSettings_wear_and_failure_non_negative"
    CHECK (
      "machineReplacementCost" >= 0
      AND "machineLifeHours" >= 0
      AND "machineWearCostPerHour" >= 0
      AND "failurePercent" >= 0
      AND "failurePercent" <= 100
    );

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '1605757fa3df2f6484669b92223ce3d80db782b28a75e08074ba8ec2bfc9e7e3', now(), '20261114000000_machine_wear_and_failures', NULL, now(), 1);

DO $verify$
DECLARE
  cols text[] := ARRAY[
    'machineReplacementCost',
    'machineLifeHours',
    'machineWearCostPerHour',
    'failurePercent'
  ];
  found_count int;
BEGIN
  SELECT count(*) INTO found_count
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'CenterSettings' AND column_name = ANY (cols);
  IF found_count <> 4 THEN
    RAISE EXCEPTION 'VERIFY: faltan columnas en CenterSettings (% de 4).', found_count;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CenterSettings_wear_and_failure_non_negative') THEN
    RAISE EXCEPTION 'VERIFY: falta el CHECK CenterSettings_wear_and_failure_non_negative.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."CenterSettings"'::regclass) THEN
    RAISE EXCEPTION 'VERIFY: CenterSettings debe seguir con RLS activo.';
  END IF;
  RAISE NOTICE 'VERIFY OK: columnas, CHECK, RLS y registro de la migración 20261114000000_machine_wear_and_failures.';
END
$verify$;

COMMIT;

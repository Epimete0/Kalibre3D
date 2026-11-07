-- Kalibre (saas3d) · Producción · Migración 20261110000000_guided_setup_costs (inicio guiado: costos opcionales).
-- Qué hace: agrega 5 columnas con valor por defecto a public."CenterSettings" y un CHECK de rangos.
-- No modifica datos existentes, políticas RLS, grants ni funciones.
-- Cómo usar: Supabase → SQL Editor → pegar este archivo completo → Run. Es seguro reintentarlo: si la migración ya
-- está registrada, se detiene sin cambiar nada. Aplicar ANTES de desplegar el código que usa estas columnas.
-- SHA-256 (LF) de migration.sql: cf3f99e60b21605455bd63b5d6f3ec892d54fff46f373ccacf5051a8cac77ff5

BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $preflight$
DECLARE
  previous text[] := ARRAY[
    '20261107000000_core_multitenant',
    '20261108000000_phase1_orders_money',
    '20261108000100_fix_money_void_check',
    '20261109000000_phase2_catalog_spools_stock'
  ];
  missing text[];
  unfinished text[];
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NULL OR to_regclass('public."CenterSettings"') IS NULL THEN
    RAISE EXCEPTION 'PREFLIGHT: falta el esquema inicial de Kalibre. Aplicar primero el paquete 20261108.';
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

  IF EXISTS (SELECT 1 FROM public."_prisma_migrations" WHERE migration_name = '20261110000000_guided_setup_costs') THEN
    RAISE EXCEPTION 'PREFLIGHT: la migración 20261110000000_guided_setup_costs ya está registrada. No hay nada que aplicar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'CenterSettings' AND column_name = 'vatPercent'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT: CenterSettings ya tiene columnas de esta migración sin estar registrada. Revisar manualmente.';
  END IF;
END
$preflight$;

-- ============================================================
-- 20261110000000_guided_setup_costs
-- ============================================================
-- Inicio guiado: costos opcionales del taller (onyx.md, entrada 2026-11-08 "Inicio guiado").
-- Solo agrega columnas con valor por defecto: no cambia datos existentes ni políticas RLS.
-- electricityKwhPrice y printerWatts permiten calcular electricityCostPerHour (precio kWh × W / 1000).
-- extraCommissionPercent: comisión adicional por venta (p. ej. Mercado Pago o pasarela).
-- vatPercent: IVA incluido en los precios (0 = no se considera). Solo para calcular; no emite documentos.
-- defaultMarginPercent: margen de ganancia mínimo sugerido por el cotizador.
ALTER TABLE public."CenterSettings"
  ADD COLUMN "electricityKwhPrice" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "printerWatts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "extraCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN "defaultMarginPercent" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE public."CenterSettings"
  ADD CONSTRAINT "CenterSettings_guided_costs_check" CHECK (
    "electricityKwhPrice" >= 0 AND "electricityKwhPrice" <= 100000
    AND "printerWatts" >= 0 AND "printerWatts" <= 10000
    AND "extraCommissionPercent" >= 0 AND "extraCommissionPercent" <= 50
    AND "vatPercent" >= 0 AND "vatPercent" <= 50
    AND "defaultMarginPercent" >= 0 AND "defaultMarginPercent" <= 95
  );

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, 'cf3f99e60b21605455bd63b5d6f3ec892d54fff46f373ccacf5051a8cac77ff5', now(), '20261110000000_guided_setup_costs', NULL, now(), 1);

DO $verify$
DECLARE
  columns_found integer;
BEGIN
  SELECT count(*) INTO columns_found FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'CenterSettings'
     AND column_name IN ('electricityKwhPrice', 'printerWatts', 'extraCommissionPercent', 'vatPercent', 'defaultMarginPercent');
  IF columns_found <> 5 THEN
    RAISE EXCEPTION 'VERIFY: se esperaban 5 columnas nuevas en CenterSettings y hay %.', columns_found;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CenterSettings_guided_costs_check') THEN
    RAISE EXCEPTION 'VERIFY: falta el CHECK CenterSettings_guided_costs_check.';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public."CenterSettings"'::regclass) THEN
    RAISE EXCEPTION 'VERIFY: CenterSettings debe seguir con RLS activo.';
  END IF;
  RAISE NOTICE 'VERIFY OK: columnas, CHECK, RLS y registro de la migración 20261110000000_guided_setup_costs.';
END
$verify$;

COMMIT;

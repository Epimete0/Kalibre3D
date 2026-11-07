-- PREFLIGHT de solo lectura
-- Kalibre (saas3d) · Lote fundacional 2026-11-08: 4 migraciones (20261107000000_core_multitenant … 20261109000000_phase2_catalog_spools_stock).
-- GENERADO por scripts/production/generate-20261108-initial-packages.mjs. No editar a mano: regenerar.
-- No modifica nada. Ejecutar primero en Supabase SQL Editor o psql (DIRECT_URL) y revisar que termine con PREFLIGHT OK.

BEGIN READ ONLY;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL idle_in_transaction_session_timeout = '120s';
DO $preflight$
DECLARE
  batch text[] := ARRAY[
    '20261107000000_core_multitenant',
    '20261108000000_phase1_orders_money',
    '20261108000100_fix_money_void_check',
    '20261109000000_phase2_catalog_spools_stock'
  ];
  app_tables text[] := ARRAY[
    'Profile',
    'Center',
    'CenterMember',
    'InvitationCode',
    'OnboardingDismissal',
    'CenterSettings',
    'Product',
    'ProductMovement',
    'Spool',
    'SpoolMovement',
    'Customer',
    'Order',
    'OrderItem',
    'OrderEvent',
    'MoneyTransaction'
  ];
  unfinished text[];
  already text[];
  existing_tables text[] := '{}';
  tbl text;
  bypass boolean;
  blocked integer;
BEGIN
  SELECT rolbypassrls OR rolsuper INTO bypass FROM pg_roles WHERE rolname = current_user;
  IF bypass IS NOT TRUE THEN
    RAISE EXCEPTION 'PREFLIGHT: la conexión debe ser administrativa (BYPASSRLS o superusuario). Usuario actual: %.', current_user;
  END IF;

  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    SELECT coalesce(array_agg(migration_name ORDER BY migration_name), '{}') INTO unfinished
      FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
    IF cardinality(unfinished) > 0 THEN
      RAISE EXCEPTION 'PREFLIGHT: hay migraciones sin terminar en el historial: %.', unfinished;
    END IF;

    SELECT coalesce(array_agg(migration_name ORDER BY migration_name), '{}') INTO already
      FROM public."_prisma_migrations" WHERE migration_name = ANY (batch);
    IF cardinality(already) > 0 THEN
      RAISE EXCEPTION 'PREFLIGHT: el lote ya está registrado (total o parcialmente): %. No continuar sin revisar.', already;
    END IF;
  END IF;

  FOREACH tbl IN ARRAY app_tables LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      existing_tables := existing_tables || tbl;
    END IF;
  END LOOP;
  IF cardinality(existing_tables) > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: ya existen tablas de la aplicación en public: %. Revisar manualmente.', existing_tables;
  END IF;

  SELECT count(*) INTO blocked FROM pg_stat_activity
   WHERE datname = current_database() AND pid <> pg_backend_pid()
     AND (wait_event_type = 'Lock' OR state = 'idle in transaction');
  IF blocked > 0 THEN
    RAISE EXCEPTION 'PREFLIGHT: % sesión(es) bloqueada(s) o idle in transaction. Reintentar cuando se liberen.', blocked;
  END IF;

  RAISE NOTICE 'PREFLIGHT OK: base limpia, privilegios administrativos verificados y sin bloqueos.';
END
$preflight$;
SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS tiene_tabla_prisma_migrations;
ROLLBACK;

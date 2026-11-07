-- VERIFICACIÓN posterior (solo lectura)
-- Kalibre (saas3d) · Lote fundacional 2026-11-08: 4 migraciones (20261107000000_core_multitenant … 20261109000000_phase2_catalog_spools_stock).
-- GENERADO por scripts/production/generate-20261108-initial-packages.mjs. No editar a mano: regenerar.
-- Ejecutar después de 02-apply. Debe terminar con POSTFLIGHT OK y sin excepciones.

BEGIN READ ONLY;
DO $verify$
DECLARE
  batch text[] := ARRAY[
    '20261107000000_core_multitenant',
    '20261108000000_phase1_orders_money',
    '20261108000100_fix_money_void_check',
    '20261109000000_phase2_catalog_spools_stock'
  ];
  expected_checksums text[] := ARRAY[
    'cf0d57f17c777acfa4eda9e21985d2093d498e6f0c3e577b239d3f5962cc949e',
    '19873a131d7b8d0795c98843f2d7db982dee133d91fe641da74d4508a02e26a0',
    '420b61ec3e95f3fa9d391797fd61609c4daecaef8a2ac0f66d49952250801dd2',
    '01d2b96ed05323ac7dfa128333789df883badad54a58998ebc090f06f3d38214'
  ];
  i integer;
  found text;
BEGIN
  FOR i IN 1..cardinality(batch) LOOP
    SELECT checksum INTO found FROM public."_prisma_migrations"
     WHERE migration_name = batch[i] AND finished_at IS NOT NULL AND rolled_back_at IS NULL;
    IF found IS NULL THEN RAISE EXCEPTION 'VERIFY: migración % sin registrar o sin terminar.', batch[i]; END IF;
    IF found <> expected_checksums[i] THEN RAISE EXCEPTION 'VERIFY: checksum distinto para %.', batch[i]; END IF;
  END LOOP;
END
$verify$;
DO $structure$
DECLARE
  problems text[] := '{}';
  all_tables text[] := ARRAY[
    '_prisma_migrations',
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
  server_only text[] := ARRAY[
    '_prisma_migrations',
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
  direct_rls text[] := ARRAY['Profile', 'Center', 'CenterMember', 'InvitationCode', 'OnboardingDismissal'];
  triggers text[] := ARRAY[
    'CenterMember_last_owner_guard',
    'Order_delete_guard',
    'OrderEvent_immutable',
    'MoneyTransaction_guard',
    'Product_delete_guard',
    'ProductMovement_immutable',
    'Spool_delete_guard',
    'SpoolMovement_immutable'
  ];
  tbl text;
  trig text;
BEGIN
  FOREACH tbl IN ARRAY all_tables LOOP
    IF to_regclass(format('public.%I', tbl)) IS NULL THEN
      problems := problems || ('tabla ausente: ' || tbl);
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE oid = to_regclass(format('public.%I', tbl)) AND relrowsecurity
    ) THEN
      problems := problems || ('RLS inactivo en: ' || tbl);
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY server_only LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      IF has_table_privilege('anon', format('public.%I', tbl), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
         OR has_table_privilege('authenticated', format('public.%I', tbl), 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') THEN
        problems := problems || ('ACL abierta en SERVER_ONLY: ' || tbl);
      END IF;
    END IF;
  END LOOP;

  FOREACH tbl IN ARRAY direct_rls LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      IF has_table_privilege('anon', format('public.%I', tbl), 'SELECT, INSERT, UPDATE, DELETE') THEN
        problems := problems || ('anon con privilegios en: ' || tbl);
      END IF;
    END IF;
  END LOOP;

  IF to_regnamespace('app_private') IS NULL THEN
    problems := problems || 'esquema app_private ausente';
  ELSIF has_schema_privilege('anon', 'app_private', 'USAGE')
     OR has_schema_privilege('authenticated', 'app_private', 'USAGE') THEN
    problems := problems || 'esquema app_private expuesto a la API';
  END IF;

  IF to_regprocedure('app_private.is_center_member(uuid)') IS NULL THEN
    problems := problems || 'función app_private.is_center_member ausente';
  END IF;
  IF to_regprocedure('app_private.has_center_role(uuid,text[])') IS NULL THEN
    problems := problems || 'función app_private.has_center_role ausente';
  END IF;

  FOREACH trig IN ARRAY triggers LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trig AND NOT tgisinternal) THEN
      problems := problems || ('trigger ausente: ' || trig);
    END IF;
  END LOOP;

  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT: faltan o difieren objetos esperados: %.', problems;
  END IF;

  RAISE NOTICE 'POSTFLIGHT OK: 16 tablas, RLS, ACL SERVER_ONLY, app_private y triggers verificados.';
END
$structure$;
SELECT migration_name, checksum, finished_at
  FROM public."_prisma_migrations"
 ORDER BY migration_name;
ROLLBACK;

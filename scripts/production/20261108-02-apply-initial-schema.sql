-- APLICACIÓN en producción (Supabase)
-- Kalibre (saas3d) · Lote fundacional 2026-11-08: 4 migraciones (20261107000000_core_multitenant … 20261109000000_phase2_catalog_spools_stock).
-- GENERADO por scripts/production/generate-20261108-initial-packages.mjs. No editar a mano: regenerar.
-- REQUIERE AUTORIZACIÓN EXPLÍCITA. Ejecutar solo después de que 00-preflight y 01-dry-run hayan terminado OK.
-- Una sola transacción: si cualquier paso falla, no queda nada aplicado ni registrado.

BEGIN ISOLATION LEVEL REPEATABLE READ;
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

-- Tabla de historial de Prisma (necesaria en una base nueva de Supabase antes de la migración 0.4)
CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 20261107000000_core_multitenant
-- SHA-256 (LF): cf0d57f17c777acfa4eda9e21985d2093d498e6f0c3e577b239d3f5962cc949e
-- ============================================================
-- =============================================================================
-- saas3d · 20261107000000_core_multitenant
-- Migración fundacional: núcleo multi-tenant heredado de Kurova.
--
-- Consolida el estado final real de Kurova (volcado kurova-core-tables.sql y
-- kurova-app-private.sql) para Profile, Center, CenterMember, InvitationCode y
-- OnboardingDismissal, más el endurecimiento de public."_prisma_migrations".
-- El detalle de origen de cada bloque y lo excluido está en
-- docs/migrations/20261107000000_core_multitenant.md.
--
-- Requisitos: PostgreSQL de Supabase (esquema auth, función auth.uid() y roles
-- anon, authenticated y service_role). Prisma crea public."_prisma_migrations"
-- antes de ejecutar esta migración.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Tablas, columnas, defaults, CHECK, PK e índices únicos
--    Origen: volcado final (20260712190300_auth_centers_rls,
--    20260712190600_onboarding_dismissals, 20260721201000_center_archive,
--    20260829140000_center_time_zone y el renombre de roles a PROFESSIONAL).
--    Sin "nameChangedAt" (el límite de 30 días para renombrar no se porta) y
--    sin "CenterMember"."schedulable" (columna exclusiva de la agenda de Kurova).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public."Profile" (
    id uuid NOT NULL,
    "displayName" text,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "Profile_pkey" PRIMARY KEY (id),
    CONSTRAINT "Profile_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."Center" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "timeZone" text,
    CONSTRAINT "Center_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public."CenterMember" (
    "centerId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    role text DEFAULT 'PROFESSIONAL'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "CenterMember_pkey" PRIMARY KEY ("centerId", "userId"),
    CONSTRAINT "CenterMember_role_check" CHECK ((role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text, 'PROFESSIONAL'::text, 'VIEWER'::text]))),
    CONSTRAINT "CenterMember_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"(id) ON DELETE CASCADE,
    CONSTRAINT "CenterMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Profile"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public."InvitationCode" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "codeHash" text NOT NULL,
    role text NOT NULL,
    "expiresAt" timestamp with time zone NOT NULL,
    "revokedAt" timestamp with time zone,
    "redeemedAt" timestamp with time zone,
    "createdByUserId" uuid NOT NULL,
    "redeemedByUserId" uuid,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "centerId" uuid NOT NULL,
    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY (id),
    CONSTRAINT "InvitationCode_codeHash_key" UNIQUE ("codeHash"),
    CONSTRAINT "InvitationCode_role_check" CHECK ((role = ANY (ARRAY['ADMIN'::text, 'PROFESSIONAL'::text, 'VIEWER'::text]))),
    CONSTRAINT "InvitationCode_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"(id) ON DELETE CASCADE,
    CONSTRAINT "InvitationCode_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."Profile"(id) ON DELETE RESTRICT,
    CONSTRAINT "InvitationCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES public."Profile"(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public."OnboardingDismissal" (
    "userId" uuid NOT NULL,
    "centerId" uuid NOT NULL,
    "dismissedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "OnboardingDismissal_pkey" PRIMARY KEY ("userId", "centerId"),
    CONSTRAINT "OnboardingDismissal_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"(id) ON DELETE CASCADE,
    CONSTRAINT "OnboardingDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."Profile"(id) ON DELETE CASCADE
);


-- -----------------------------------------------------------------------------
-- 2. Índices
--    Origen: volcado final (20260712190300, 20260712190600, 20260721201000).
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "Center_active_idx" ON public."Center" USING btree (active);
CREATE INDEX IF NOT EXISTS "CenterMember_centerId_active_idx" ON public."CenterMember" USING btree ("centerId", active);
CREATE INDEX IF NOT EXISTS "CenterMember_userId_active_idx" ON public."CenterMember" USING btree ("userId", active);
CREATE INDEX IF NOT EXISTS "InvitationCode_centerId_expiresAt_idx" ON public."InvitationCode" USING btree ("centerId", "expiresAt");
CREATE INDEX IF NOT EXISTS "OnboardingDismissal_centerId_idx" ON public."OnboardingDismissal" USING btree ("centerId");


-- -----------------------------------------------------------------------------
-- 3. Esquema privado app_private y funciones SECURITY DEFINER
--    Origen: 20260830120000_security_definer_private_schema (esquema) y
--    kurova-app-private.sql (cuerpos finales, que vienen de
--    20260721201000_center_archive). Se crean directamente en app_private en
--    lugar de crearlas en public y moverlas.
--    El esquema no se expone: nadie salvo su dueño tiene USAGE, por lo que las
--    funciones no se pueden invocar por RPC. Las políticas RLS las llaman por
--    OID, así que solo se necesita EXECUTE para authenticated (como en Kurova:
--    20260712190300, 20260712190400 y 20260721201000).
-- -----------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS app_private AUTHORIZATION postgres;

REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.is_center_member(target_center_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CenterMember" member
    JOIN "Center" center ON center."id" = member."centerId"
    WHERE member."centerId" = target_center_id
      AND member."userId" = auth.uid()
      AND member."active" = true
      AND center."active" = true
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_center_role(target_center_id uuid, allowed_roles text[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "CenterMember" member
    JOIN "Center" center ON center."id" = member."centerId"
    WHERE member."centerId" = target_center_id
      AND member."userId" = auth.uid()
      AND member."active" = true
      AND center."active" = true
      AND member."role" = ANY(allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION app_private.is_center_member(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION app_private.has_center_role(uuid, text[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_center_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_center_role(uuid, text[]) TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. Row Level Security
--    Origen: volcado final. RLS activado en las 5 tablas del núcleo y en
--    public."_prisma_migrations" (esta última sin ninguna política: SERVER_ONLY).
-- -----------------------------------------------------------------------------

ALTER TABLE public."Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Center" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CenterMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvitationCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OnboardingDismissal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 5. Políticas
--    Origen: volcado final (20260712190300, 20260721201000,
--    20260722110000_split_invitation_onboarding_rls y la separación de
--    profile_self_access en profile_self_*). Sin políticas FOR ALL ni DELETE.
-- -----------------------------------------------------------------------------

-- 5.1 Profile: cada persona solo ve, crea y edita su propio perfil.
DROP POLICY IF EXISTS profile_self_select ON public."Profile";
CREATE POLICY profile_self_select ON public."Profile" FOR SELECT TO authenticated USING ((id = auth.uid()));

DROP POLICY IF EXISTS profile_self_insert ON public."Profile";
CREATE POLICY profile_self_insert ON public."Profile" FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));

DROP POLICY IF EXISTS profile_self_update ON public."Profile";
CREATE POLICY profile_self_update ON public."Profile" FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));

-- 5.2 Center: lo leen sus miembros activos; solo un OWNER activo puede archivarlo (active true → false).
DROP POLICY IF EXISTS center_member_read ON public."Center";
CREATE POLICY center_member_read ON public."Center" FOR SELECT TO authenticated USING (app_private.is_center_member(id));

DROP POLICY IF EXISTS center_owner_archive ON public."Center";
CREATE POLICY center_owner_archive ON public."Center" FOR UPDATE TO authenticated USING (((active = true) AND (EXISTS ( SELECT 1
   FROM public."CenterMember" member
  WHERE ((member."centerId" = "Center".id) AND (member."userId" = auth.uid()) AND (member.active = true) AND (member.role = 'OWNER'::text)))))) WITH CHECK (((active = false) AND (EXISTS ( SELECT 1
   FROM public."CenterMember" member
  WHERE ((member."centerId" = "Center".id) AND (member."userId" = auth.uid()) AND (member.active = true) AND (member.role = 'OWNER'::text))))));

-- 5.3 CenterMember: cada persona ve sus membresías y las de los talleres donde es miembro activo.
DROP POLICY IF EXISTS center_member_list ON public."CenterMember";
CREATE POLICY center_member_list ON public."CenterMember" FOR SELECT TO authenticated USING ((("userId" = auth.uid()) OR app_private.is_center_member("centerId")));

-- 5.4 InvitationCode: solo OWNER y ADMIN activos del taller.
DROP POLICY IF EXISTS invitation_admin_select ON public."InvitationCode";
CREATE POLICY invitation_admin_select ON public."InvitationCode" FOR SELECT TO authenticated USING (app_private.has_center_role("centerId", ARRAY['OWNER'::text, 'ADMIN'::text]));

DROP POLICY IF EXISTS invitation_admin_insert ON public."InvitationCode";
CREATE POLICY invitation_admin_insert ON public."InvitationCode" FOR INSERT TO authenticated WITH CHECK (app_private.has_center_role("centerId", ARRAY['OWNER'::text, 'ADMIN'::text]));

DROP POLICY IF EXISTS invitation_admin_update ON public."InvitationCode";
CREATE POLICY invitation_admin_update ON public."InvitationCode" FOR UPDATE TO authenticated USING (app_private.has_center_role("centerId", ARRAY['OWNER'::text, 'ADMIN'::text])) WITH CHECK (app_private.has_center_role("centerId", ARRAY['OWNER'::text, 'ADMIN'::text]));

-- 5.5 OnboardingDismissal: cada persona, solo en talleres donde es miembro activo.
DROP POLICY IF EXISTS onboarding_dismissal_self_select ON public."OnboardingDismissal";
CREATE POLICY onboarding_dismissal_self_select ON public."OnboardingDismissal" FOR SELECT TO authenticated USING ((("userId" = auth.uid()) AND app_private.is_center_member("centerId")));

DROP POLICY IF EXISTS onboarding_dismissal_self_insert ON public."OnboardingDismissal";
CREATE POLICY onboarding_dismissal_self_insert ON public."OnboardingDismissal" FOR INSERT TO authenticated WITH CHECK ((("userId" = auth.uid()) AND app_private.is_center_member("centerId")));

DROP POLICY IF EXISTS onboarding_dismissal_self_update ON public."OnboardingDismissal";
CREATE POLICY onboarding_dismissal_self_update ON public."OnboardingDismissal" FOR UPDATE TO authenticated USING ((("userId" = auth.uid()) AND app_private.is_center_member("centerId"))) WITH CHECK ((("userId" = auth.uid()) AND app_private.is_center_member("centerId")));


-- -----------------------------------------------------------------------------
-- 6. Privilegios de tabla (GRANT/REVOKE)
--    Origen: volcado final, corregido con 20260722110000 (sin DELETE en
--    InvitationCode ni OnboardingDismissal), 20260831130000_harden_prisma_migrations_acl
--    y 20261106100000_revoke_excess_api_privileges (anon sin privilegios; sin
--    TRUNCATE, REFERENCES ni TRIGGER para la API; Center sin INSERT/DELETE;
--    CenterMember solo SELECT).
--    Supabase concede ALL por defecto a anon, authenticated y service_role en
--    tablas nuevas de public; por eso primero se revoca todo y luego se concede
--    exactamente el conjunto final. No se crean ALTER DEFAULT PRIVILEGES.
-- -----------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE
  public."Profile", public."Center", public."CenterMember",
  public."InvitationCode", public."OnboardingDismissal"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Profile" TO authenticated;
GRANT SELECT, UPDATE ON TABLE public."Center" TO authenticated;
GRANT SELECT ON TABLE public."CenterMember" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public."InvitationCode" TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public."OnboardingDismissal" TO authenticated;

-- MAINTAIN existe desde PostgreSQL 17 y figura en el volcado final para authenticated.
DO $grant_maintain$
BEGIN
  IF current_setting('server_version_num')::integer >= 170000 THEN
    EXECUTE 'GRANT MAINTAIN ON TABLE public."Profile", public."Center", public."CenterMember", '
         || 'public."InvitationCode", public."OnboardingDismissal" TO authenticated';
  END IF;
END
$grant_maintain$;

GRANT ALL ON TABLE
  public."Profile", public."Center", public."CenterMember",
  public."InvitationCode", public."OnboardingDismissal"
TO service_role;

-- _prisma_migrations: SERVER_ONLY. RLS activo (bloque 4), 0 políticas y sin privilegios para la API.
REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 7. Guarda de "último dueño"
--    Origen: 20260921100000_center_last_owner_guard (sin cambios: solo toca
--    Center y CenterMember) y el bloque 4 de 20261106100000 (las funciones
--    trigger de public no se invocan por RPC).
--    Un taller activo siempre conserva al menos un OWNER activo. El trigger es
--    diferido: se evalúa al confirmar la transacción y rechaza dejar al taller
--    sin OWNER activo por cambio de rol, desactivación o borrado. No aplica a
--    talleres archivados ni eliminados.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_center_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  target_center UUID;
  center_is_active BOOLEAN;
BEGIN
  target_center := OLD."centerId";
  SELECT "active" INTO center_is_active FROM "Center" WHERE "id" = target_center;
  IF center_is_active IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "CenterMember"
    WHERE "centerId" = target_center AND "role" = 'OWNER' AND "active" = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'El taller debe conservar al menos un dueño activo.';
  END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_center_last_owner() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "CenterMember_last_owner_guard" ON public."CenterMember";
CREATE CONSTRAINT TRIGGER "CenterMember_last_owner_guard"
  AFTER UPDATE OF "role", "active" OR DELETE ON public."CenterMember"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD."role" = 'OWNER' AND OLD."active" = true)
  EXECUTE FUNCTION public.guard_center_last_owner();

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, 'cf0d57f17c777acfa4eda9e21985d2093d498e6f0c3e577b239d3f5962cc949e', now(), '20261107000000_core_multitenant', NULL, now(), 1);

-- ============================================================
-- 20261108000000_phase1_orders_money
-- SHA-256 (LF): 19873a131d7b8d0795c98843f2d7db982dee133d91fe641da74d4508a02e26a0
-- ============================================================
-- =============================================================================
-- saas3d — Fase 1: ajustes, lista de precios, clientes, ventas/pedidos y dinero.
-- Ver onyx.md 18.2 (decisiones D1–D12) y AGENTS.md.
-- Todas las tablas son SERVER_ONLY: RLS activo, 0 políticas y sin privilegios
-- para PUBLIC/anon/authenticated. La aplicación escribe por Prisma en el servidor.
-- Integridad same-center: claves foráneas compuestas (centerId, …).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Funciones de trigger genéricas (public, SECURITY INVOKER, sin EXECUTE para la API)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_center_id_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW."centerId" IS DISTINCT FROM OLD."centerId" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'No se puede cambiar el taller de un registro.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_immutable_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Este registro es historial y no se puede modificar ni borrar.';
END;
$function$;

-- -----------------------------------------------------------------------------
-- 2. Ajustes del taller (D9, D10)
-- -----------------------------------------------------------------------------

CREATE TABLE public."CenterSettings" (
  "centerId" UUID NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CLP',
  "electricityCostPerHour" INTEGER NOT NULL DEFAULT 0,
  "mlCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 19,
  "mlDefaultShippingCost" INTEGER NOT NULL DEFAULT 0,
  "defaultPackagingCost" INTEGER NOT NULL DEFAULT 0,
  "defaultCostPerKg" INTEGER NOT NULL DEFAULT 15000,
  "defaultPurgeGrams" INTEGER NOT NULL DEFAULT 0,
  "lowSpoolThresholdGrams" INTEGER NOT NULL DEFAULT 150,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "CenterSettings_pkey" PRIMARY KEY ("centerId"),
  CONSTRAINT "CenterSettings_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "CenterSettings_currency_check" CHECK ("currency" IN ('CLP','ARS','MXN','COP','PEN','UYU','BOB','PYG','USD','EUR')),
  CONSTRAINT "CenterSettings_amounts_check" CHECK ("electricityCostPerHour" >= 0 AND "mlDefaultShippingCost" >= 0 AND "defaultPackagingCost" >= 0 AND "defaultCostPerKg" >= 0 AND "defaultPurgeGrams" >= 0 AND "lowSpoolThresholdGrams" >= 0),
  CONSTRAINT "CenterSettings_ml_percent_check" CHECK ("mlCommissionPercent" >= 0 AND "mlCommissionPercent" <= 100)
);

-- -----------------------------------------------------------------------------
-- 3. Lista de precios mínima (D11)
-- -----------------------------------------------------------------------------

CREATE TABLE public."Product" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "salePrice" INTEGER NOT NULL,
  "mlPrice" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_centerId_id_key" UNIQUE ("centerId", "id"),
  CONSTRAINT "Product_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "Product_createdBy_fkey" FOREIGN KEY ("centerId", "createdByUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "Product_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 160),
  CONSTRAINT "Product_prices_check" CHECK ("salePrice" >= 0 AND ("mlPrice" IS NULL OR "mlPrice" >= 0))
);
CREATE INDEX "Product_centerId_active_idx" ON public."Product" ("centerId", "active");
-- Nombres únicos por taller, sin distinguir mayúsculas ni espacios extremos (incluye desactivados).
CREATE UNIQUE INDEX "Product_centerId_name_key" ON public."Product" ("centerId", lower(btrim("name")));

-- -----------------------------------------------------------------------------
-- 4. Clientes (D7)
-- -----------------------------------------------------------------------------

CREATE TABLE public."Customer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "instagram" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Customer_centerId_id_key" UNIQUE ("centerId", "id"),
  CONSTRAINT "Customer_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "Customer_createdBy_fkey" FOREIGN KEY ("centerId", "createdByUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "Customer_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 120),
  CONSTRAINT "Customer_lengths_check" CHECK (("phone" IS NULL OR char_length("phone") <= 40) AND ("instagram" IS NULL OR (char_length("instagram") <= 60 AND left("instagram", 1) <> '@')) AND ("notes" IS NULL OR char_length("notes") <= 1000))
);
CREATE INDEX "Customer_centerId_active_idx" ON public."Customer" ("centerId", "active");

-- -----------------------------------------------------------------------------
-- 5. Ventas y pedidos (D2, D3, D4, D12)
-- -----------------------------------------------------------------------------

CREATE TABLE public."Order" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "operationId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "customerId" UUID,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "dueDate" DATE,
  "discount" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "mlOrderRef" TEXT,
  "mlCommission" INTEGER NOT NULL DEFAULT 0,
  "mlShippingCost" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "deliveredAt" TIMESTAMPTZ(6),
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_centerId_id_key" UNIQUE ("centerId", "id"),
  CONSTRAINT "Order_centerId_number_key" UNIQUE ("centerId", "number"),
  CONSTRAINT "Order_centerId_operationId_key" UNIQUE ("centerId", "operationId"),
  CONSTRAINT "Order_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "Order_customer_fkey" FOREIGN KEY ("centerId", "customerId") REFERENCES public."Customer"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "Order_createdBy_fkey" FOREIGN KEY ("centerId", "createdByUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "Order_number_check" CHECK ("number" > 0),
  CONSTRAINT "Order_kind_check" CHECK ("kind" IN ('QUICK_SALE','ORDER')),
  CONSTRAINT "Order_channel_check" CHECK ("channel" IN ('WHATSAPP','INSTAGRAM','IN_PERSON','MERCADOLIBRE','DIGITAL','OTHER')),
  CONSTRAINT "Order_status_check" CHECK ("status" IN ('QUOTED','CONFIRMED','PRINTING','READY','DELIVERED','CANCELED','RETURNED')),
  CONSTRAINT "Order_version_check" CHECK ("version" >= 1),
  CONSTRAINT "Order_amounts_check" CHECK ("discount" >= 0 AND "total" >= 0 AND "mlCommission" >= 0 AND "mlShippingCost" >= 0),
  -- Solo las ventas de Mercado Libre llevan comisión, envío a cargo y referencia de ML (D4).
  CONSTRAINT "Order_ml_fields_check" CHECK ("channel" = 'MERCADOLIBRE' OR ("mlCommission" = 0 AND "mlShippingCost" = 0 AND "mlOrderRef" IS NULL)),
  -- Fecha de entrega presente exactamente cuando la venta se entregó (y se conserva si se devuelve).
  CONSTRAINT "Order_delivered_check" CHECK (("status" IN ('DELIVERED','RETURNED')) = ("deliveredAt" IS NOT NULL)),
  CONSTRAINT "Order_text_check" CHECK (("mlOrderRef" IS NULL OR char_length("mlOrderRef") <= 60) AND ("notes" IS NULL OR char_length("notes") <= 1000))
);
CREATE INDEX "Order_centerId_status_idx" ON public."Order" ("centerId", "status");
CREATE INDEX "Order_centerId_createdAt_idx" ON public."Order" ("centerId", "createdAt");
CREATE INDEX "Order_centerId_customerId_idx" ON public."Order" ("centerId", "customerId");

CREATE TABLE public."OrderItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "productId" UUID,
  "description" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "material" TEXT,
  "grams" INTEGER,
  "colorsCount" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItem_centerId_orderId_position_key" UNIQUE ("centerId", "orderId", "position"),
  CONSTRAINT "OrderItem_order_fkey" FOREIGN KEY ("centerId", "orderId") REFERENCES public."Order"("centerId", "id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_product_fkey" FOREIGN KEY ("centerId", "productId") REFERENCES public."Product"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "OrderItem_values_check" CHECK ("position" >= 0 AND "qty" > 0 AND "unitPrice" >= 0 AND "colorsCount" BETWEEN 1 AND 16 AND ("grams" IS NULL OR "grams" >= 0)),
  CONSTRAINT "OrderItem_description_check" CHECK (char_length(btrim("description")) BETWEEN 1 AND 200),
  CONSTRAINT "OrderItem_material_check" CHECK ("material" IS NULL OR "material" IN ('PLA','PETG','ASA','ABS','TPU','OTHER'))
);

-- Historial inmutable de estados.
CREATE TABLE public."OrderEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorUserId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderEvent_centerId_orderId_version_key" UNIQUE ("centerId", "orderId", "version"),
  CONSTRAINT "OrderEvent_order_fkey" FOREIGN KEY ("centerId", "orderId") REFERENCES public."Order"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "OrderEvent_actor_fkey" FOREIGN KEY ("centerId", "actorUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "OrderEvent_version_check" CHECK ("version" >= 1),
  CONSTRAINT "OrderEvent_status_check" CHECK ("toStatus" IN ('QUOTED','CONFIRMED','PRINTING','READY','DELIVERED','CANCELED','RETURNED') AND ("fromStatus" IS NULL OR "fromStatus" IN ('QUOTED','CONFIRMED','PRINTING','READY','DELIVERED','CANCELED','RETURNED')))
);

-- -----------------------------------------------------------------------------
-- 6. Dinero (D5, D6)
-- -----------------------------------------------------------------------------

CREATE TABLE public."MoneyTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "occurredOn" DATE NOT NULL,
  "method" TEXT NOT NULL,
  "orderId" UUID,
  "notes" TEXT,
  "recordedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "voidedAt" TIMESTAMPTZ(6),
  "voidedByUserId" UUID,
  "voidReason" TEXT,
  CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MoneyTransaction_centerId_operationId_key" UNIQUE ("centerId", "operationId"),
  CONSTRAINT "MoneyTransaction_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "MoneyTransaction_order_fkey" FOREIGN KEY ("centerId", "orderId") REFERENCES public."Order"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "MoneyTransaction_recordedBy_fkey" FOREIGN KEY ("centerId", "recordedByUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "MoneyTransaction_voidedBy_fkey" FOREIGN KEY ("centerId", "voidedByUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "MoneyTransaction_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "MoneyTransaction_method_check" CHECK ("method" IN ('TRANSFER','CASH','MERCADOPAGO','MERCADOLIBRE','OTHER')),
  CONSTRAINT "MoneyTransaction_category_check" CHECK (
    ("type" = 'INCOME' AND "category" IN ('ORDER_PAYMENT','DIGITAL_SALE','OTHER_INCOME')) OR
    ("type" = 'EXPENSE' AND "category" IN ('FILAMENT','PARTS','SHIPPING','ADVERTISING','FEES','REFUNDS','UNEXPECTED','OTHER_EXPENSE'))
  ),
  -- Cobros y reembolsos siempre pertenecen a una venta.
  CONSTRAINT "MoneyTransaction_order_required_check" CHECK ("category" NOT IN ('ORDER_PAYMENT','REFUNDS') OR "orderId" IS NOT NULL),
  -- Anulación completa o nada: fecha, autor y motivo juntos.
  CONSTRAINT "MoneyTransaction_void_check" CHECK (
    ("voidedAt" IS NULL AND "voidedByUserId" IS NULL AND "voidReason" IS NULL) OR
    ("voidedAt" IS NOT NULL AND "voidedByUserId" IS NOT NULL AND char_length(btrim("voidReason")) BETWEEN 1 AND 300)
  ),
  CONSTRAINT "MoneyTransaction_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 1000)
);
CREATE INDEX "MoneyTransaction_centerId_occurredOn_idx" ON public."MoneyTransaction" ("centerId", "occurredOn");
CREATE INDEX "MoneyTransaction_centerId_orderId_idx" ON public."MoneyTransaction" ("centerId", "orderId");

-- Un movimiento no se borra y solo admite UNA anulación; ningún otro dato cambia.
CREATE OR REPLACE FUNCTION public.guard_money_transaction()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Los movimientos de dinero no se borran: se anulan.';
  END IF;
  IF OLD."voidedAt" IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Este movimiento ya está anulado.';
  END IF;
  IF NEW."voidedAt" IS NULL
     OR (NEW."id", NEW."centerId", NEW."operationId", NEW."type", NEW."category", NEW."amount", NEW."occurredOn", NEW."method", NEW."orderId", NEW."notes", NEW."recordedByUserId", NEW."createdAt")
        IS DISTINCT FROM
        (OLD."id", OLD."centerId", OLD."operationId", OLD."type", OLD."category", OLD."amount", OLD."occurredOn", OLD."method", OLD."orderId", OLD."notes", OLD."recordedByUserId", OLD."createdAt") THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Un movimiento de dinero solo se puede anular.';
  END IF;
  RETURN NEW;
END;
$function$;

-- Una venta con historial o dinero no se borra (se cancela).
CREATE OR REPLACE FUNCTION public.guard_order_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM "OrderEvent" WHERE "centerId" = OLD."centerId" AND "orderId" = OLD."id")
     OR EXISTS (SELECT 1 FROM "MoneyTransaction" WHERE "centerId" = OLD."centerId" AND "orderId" = OLD."id") THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Una venta con historial o dinero no se borra: se cancela.';
  END IF;
  RETURN OLD;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 7. Triggers
-- -----------------------------------------------------------------------------

CREATE TRIGGER "CenterSettings_center_immutable" BEFORE UPDATE ON public."CenterSettings" FOR EACH ROW EXECUTE FUNCTION public.guard_center_id_immutable();
CREATE TRIGGER "Product_center_immutable" BEFORE UPDATE ON public."Product" FOR EACH ROW EXECUTE FUNCTION public.guard_center_id_immutable();
CREATE TRIGGER "Customer_center_immutable" BEFORE UPDATE ON public."Customer" FOR EACH ROW EXECUTE FUNCTION public.guard_center_id_immutable();
CREATE TRIGGER "Order_center_immutable" BEFORE UPDATE ON public."Order" FOR EACH ROW EXECUTE FUNCTION public.guard_center_id_immutable();
CREATE TRIGGER "OrderItem_center_immutable" BEFORE UPDATE ON public."OrderItem" FOR EACH ROW EXECUTE FUNCTION public.guard_center_id_immutable();
CREATE TRIGGER "Order_delete_guard" BEFORE DELETE ON public."Order" FOR EACH ROW EXECUTE FUNCTION public.guard_order_delete();
CREATE TRIGGER "OrderEvent_immutable" BEFORE UPDATE OR DELETE ON public."OrderEvent" FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_row();
CREATE TRIGGER "MoneyTransaction_guard" BEFORE UPDATE OR DELETE ON public."MoneyTransaction" FOR EACH ROW EXECUTE FUNCTION public.guard_money_transaction();

REVOKE ALL ON FUNCTION public.guard_center_id_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_immutable_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_money_transaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_delete() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 8. Seguridad SERVER_ONLY: RLS activo, sin políticas y sin privilegios para la API
-- -----------------------------------------------------------------------------

ALTER TABLE public."CenterSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MoneyTransaction" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public."CenterSettings", public."Product", public."Customer", public."Order",
  public."OrderItem", public."OrderEvent", public."MoneyTransaction"
FROM PUBLIC, anon, authenticated;

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '19873a131d7b8d0795c98843f2d7db982dee133d91fe641da74d4508a02e26a0', now(), '20261108000000_phase1_orders_money', NULL, now(), 1);

-- ============================================================
-- 20261108000100_fix_money_void_check
-- SHA-256 (LF): 420b61ec3e95f3fa9d391797fd61609c4daecaef8a2ac0f66d49952250801dd2
-- ============================================================
-- Corrige MoneyTransaction_void_check: con "voidReason" NULL, char_length(NULL) BETWEEN 1 AND 300 es NULL
-- y PostgreSQL acepta un CHECK cuyo resultado es NULL, por lo que se podía anular sin motivo.
-- Detectado por tests/phase1-integrity.integration.test.ts (prueba observada en rojo antes de corregir).
ALTER TABLE public."MoneyTransaction" DROP CONSTRAINT "MoneyTransaction_void_check";
ALTER TABLE public."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_void_check" CHECK (
  ("voidedAt" IS NULL AND "voidedByUserId" IS NULL AND "voidReason" IS NULL) OR
  ("voidedAt" IS NOT NULL AND "voidedByUserId" IS NOT NULL AND "voidReason" IS NOT NULL AND char_length(btrim("voidReason")) BETWEEN 1 AND 300)
);

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '420b61ec3e95f3fa9d391797fd61609c4daecaef8a2ac0f66d49952250801dd2', now(), '20261108000100_fix_money_void_check', NULL, now(), 1);

-- ============================================================
-- 20261109000000_phase2_catalog_spools_stock
-- SHA-256 (LF): 01d2b96ed05323ac7dfa128333789df883badad54a58998ebc090f06f3d38214
-- ============================================================
-- =============================================================================
-- saas3d — Fase 2: catálogo completo de piezas, stock inmutable y bobinas de filamento.
-- Ver onyx.md 18.3, decisiones D13–D19 y AGENTS.md.
-- Todas las tablas son SERVER_ONLY: RLS activo, 0 políticas y sin privilegios
-- para PUBLIC/anon/authenticated.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Ampliación de Product (D14, D16)
-- -----------------------------------------------------------------------------

ALTER TABLE public."Product"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "material" TEXT NOT NULL DEFAULT 'PETG',
  ADD COLUMN "grams" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "printMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "colorsCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "purgeGrams" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currentStock" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "minStock" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."Product"
  ADD CONSTRAINT "Product_category_check" CHECK ("category" IS NULL OR (char_length(btrim("category")) BETWEEN 1 AND 80)),
  ADD CONSTRAINT "Product_material_check" CHECK ("material" IN ('PLA','PETG','ASA','ABS','TPU','OTHER')),
  ADD CONSTRAINT "Product_specs_check" CHECK (
    "grams" >= 0 AND
    "printMinutes" >= 0 AND
    "colorsCount" BETWEEN 1 AND 16 AND
    "purgeGrams" >= 0 AND
    "currentStock" >= 0 AND
    "minStock" >= 0
  );

-- -----------------------------------------------------------------------------
-- 2. Movimientos inmutables de stock de piezas (ProductMovement, D15)
-- -----------------------------------------------------------------------------

CREATE TABLE public."ProductMovement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "delta" INTEGER NOT NULL,
  "resultingStock" INTEGER NOT NULL,
  "orderId" UUID,
  "notes" TEXT,
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "ProductMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductMovement_centerId_operationId_key" UNIQUE ("centerId", "operationId"),
  CONSTRAINT "ProductMovement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductMovement_product_fkey" FOREIGN KEY ("centerId", "productId") REFERENCES public."Product"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ProductMovement_order_fkey" FOREIGN KEY ("centerId", "orderId") REFERENCES public."Order"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "ProductMovement_actor_fkey" FOREIGN KEY ("centerId", "actorUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "ProductMovement_kind_delta_check" CHECK (
    ("kind" IN ('INITIAL','ENTRY') AND "delta" > 0) OR
    ("kind" = 'EXIT' AND "delta" < 0) OR
    ("kind" = 'ADJUST' AND "delta" <> 0)
  ),
  CONSTRAINT "ProductMovement_resulting_check" CHECK ("resultingStock" >= 0),
  CONSTRAINT "ProductMovement_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 500)
);

CREATE INDEX "ProductMovement_centerId_productId_createdAt_idx"
  ON public."ProductMovement" ("centerId", "productId", "createdAt" DESC);

-- -----------------------------------------------------------------------------
-- 3. Bobinas de filamento (Spool) y movimientos de gramos (SpoolMovement, D17)
-- -----------------------------------------------------------------------------

CREATE TABLE public."Spool" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "material" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "brand" TEXT,
  "totalGrams" INTEGER NOT NULL,
  "remainingGrams" INTEGER NOT NULL,
  "pricePaid" INTEGER NOT NULL,
  "purchasedOn" DATE NOT NULL,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "Spool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Spool_centerId_id_key" UNIQUE ("centerId", "id"),
  CONSTRAINT "Spool_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "Spool_createdBy_fkey" FOREIGN KEY ("centerId", "createdByUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "Spool_material_check" CHECK ("material" IN ('PLA','PETG','ASA','ABS','TPU','OTHER')),
  CONSTRAINT "Spool_color_check" CHECK (char_length(btrim("color")) BETWEEN 1 AND 80),
  CONSTRAINT "Spool_brand_check" CHECK ("brand" IS NULL OR (char_length(btrim("brand")) BETWEEN 1 AND 80)),
  CONSTRAINT "Spool_values_check" CHECK (
    "totalGrams" > 0 AND
    "totalGrams" <= 50000 AND
    "remainingGrams" >= 0 AND
    "pricePaid" >= 0
  ),
  CONSTRAINT "Spool_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 500)
);

CREATE INDEX "Spool_centerId_active_idx" ON public."Spool" ("centerId", "active");
CREATE INDEX "Spool_centerId_material_active_idx" ON public."Spool" ("centerId", "material", "active");

CREATE TABLE public."SpoolMovement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "centerId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "spoolId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "deltaGrams" INTEGER NOT NULL,
  "resultingGrams" INTEGER NOT NULL,
  "orderId" UUID,
  "notes" TEXT,
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "SpoolMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SpoolMovement_centerId_operationId_key" UNIQUE ("centerId", "operationId"),
  CONSTRAINT "SpoolMovement_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES public."Center"("id") ON DELETE CASCADE,
  CONSTRAINT "SpoolMovement_spool_fkey" FOREIGN KEY ("centerId", "spoolId") REFERENCES public."Spool"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "SpoolMovement_order_fkey" FOREIGN KEY ("centerId", "orderId") REFERENCES public."Order"("centerId", "id") ON DELETE RESTRICT,
  CONSTRAINT "SpoolMovement_actor_fkey" FOREIGN KEY ("centerId", "actorUserId") REFERENCES public."CenterMember"("centerId", "userId") ON DELETE RESTRICT,
  CONSTRAINT "SpoolMovement_kind_delta_check" CHECK (
    ("kind" = 'INITIAL' AND "deltaGrams" > 0) OR
    ("kind" = 'CONSUME' AND "deltaGrams" < 0) OR
    ("kind" = 'ADJUST' AND "deltaGrams" <> 0)
  ),
  CONSTRAINT "SpoolMovement_resulting_check" CHECK ("resultingGrams" >= 0),
  CONSTRAINT "SpoolMovement_notes_check" CHECK ("notes" IS NULL OR char_length("notes") <= 500)
);

CREATE INDEX "SpoolMovement_centerId_spoolId_createdAt_idx"
  ON public."SpoolMovement" ("centerId", "spoolId", "createdAt" DESC);

-- -----------------------------------------------------------------------------
-- 4. Funciones y triggers de ciclo de vida e inmutabilidad
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_product_movement()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Los movimientos de stock son inmutables y no se pueden modificar.';
  END IF;
  -- En DELETE: solo se permite borrar un movimiento INITIAL desde el trigger de eliminación de un producto nunca usado (pg_trigger_depth() > 1).
  IF OLD."kind" <> 'INITIAL' OR pg_trigger_depth() <= 1 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Los movimientos de stock son inmutables y no se pueden borrar.';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_product_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public."OrderItem" WHERE "centerId" = OLD."centerId" AND "productId" = OLD."id")
     OR EXISTS (SELECT 1 FROM public."ProductMovement" WHERE "centerId" = OLD."centerId" AND "productId" = OLD."id" AND "kind" <> 'INITIAL') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'No se puede eliminar la pieza porque ya tiene pedidos o movimientos reales de stock. Puedes desactivarla.';
  END IF;
  DELETE FROM public."ProductMovement"
  WHERE "centerId" = OLD."centerId" AND "productId" = OLD."id" AND "kind" = 'INITIAL';
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_spool_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Las bobinas no se eliminan: se desactivan.';
END;
$function$;

CREATE TRIGGER "Product_delete_guard"
  BEFORE DELETE ON public."Product"
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_delete();

CREATE TRIGGER "ProductMovement_immutable"
  BEFORE UPDATE OR DELETE ON public."ProductMovement"
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_movement();

CREATE TRIGGER "Spool_center_immutable"
  BEFORE UPDATE ON public."Spool"
  FOR EACH ROW EXECUTE FUNCTION public.guard_center_id_immutable();

CREATE TRIGGER "Spool_delete_guard"
  BEFORE DELETE ON public."Spool"
  FOR EACH ROW EXECUTE FUNCTION public.guard_spool_delete();

CREATE TRIGGER "SpoolMovement_immutable"
  BEFORE UPDATE OR DELETE ON public."SpoolMovement"
  FOR EACH ROW EXECUTE FUNCTION public.guard_immutable_row();

REVOKE ALL ON FUNCTION public.guard_product_movement() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_product_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_spool_delete() FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. Seguridad SERVER_ONLY: RLS activo, 0 políticas y sin privilegios para la API
-- -----------------------------------------------------------------------------

ALTER TABLE public."ProductMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Spool" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SpoolMovement" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public."ProductMovement", public."Spool", public."SpoolMovement"
FROM PUBLIC, anon, authenticated;

INSERT INTO public."_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
VALUES (gen_random_uuid()::text, '01d2b96ed05323ac7dfa128333789df883badad54a58998ebc090f06f3d38214', now(), '20261109000000_phase2_catalog_spools_stock', NULL, now(), 1);

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
COMMIT;

SELECT migration_name, finished_at IS NOT NULL AS terminada
  FROM public."_prisma_migrations"
 WHERE migration_name IN ('20261107000000_core_multitenant', '20261108000000_phase1_orders_money', '20261108000100_fix_money_void_check', '20261109000000_phase2_catalog_spools_stock')
 ORDER BY migration_name;

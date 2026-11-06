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

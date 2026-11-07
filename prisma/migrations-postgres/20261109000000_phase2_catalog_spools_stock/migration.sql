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

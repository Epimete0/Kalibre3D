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

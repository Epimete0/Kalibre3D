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

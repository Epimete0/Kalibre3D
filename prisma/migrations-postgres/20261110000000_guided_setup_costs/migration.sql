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

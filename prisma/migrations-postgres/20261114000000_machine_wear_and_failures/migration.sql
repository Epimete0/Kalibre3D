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

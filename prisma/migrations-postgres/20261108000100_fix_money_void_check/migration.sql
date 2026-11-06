-- Corrige MoneyTransaction_void_check: con "voidReason" NULL, char_length(NULL) BETWEEN 1 AND 300 es NULL
-- y PostgreSQL acepta un CHECK cuyo resultado es NULL, por lo que se podía anular sin motivo.
-- Detectado por tests/phase1-integrity.integration.test.ts (prueba observada en rojo antes de corregir).
ALTER TABLE public."MoneyTransaction" DROP CONSTRAINT "MoneyTransaction_void_check";
ALTER TABLE public."MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_void_check" CHECK (
  ("voidedAt" IS NULL AND "voidedByUserId" IS NULL AND "voidReason" IS NULL) OR
  ("voidedAt" IS NOT NULL AND "voidedByUserId" IS NOT NULL AND "voidReason" IS NOT NULL AND char_length(btrim("voidReason")) BETWEEN 1 AND 300)
);

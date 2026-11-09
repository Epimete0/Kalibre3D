-- Rentabilidad por pieza: costo unitario estimado de cada línea de venta, guardado al momento de vender
-- (filamento + purga + luz + embalaje con los costos del taller de ese día). NULL = no se pudo calcular
-- (venta escrita a mano sin gramos, o líneas anteriores a esta migración, que se estiman con costos actuales).
-- Solo agrega una columna opcional y su CHECK: no cambia datos existentes ni políticas RLS.
ALTER TABLE public."OrderItem"
  ADD COLUMN "unitCost" INTEGER;

ALTER TABLE public."OrderItem"
  ADD CONSTRAINT "OrderItem_unit_cost_check" CHECK ("unitCost" IS NULL OR ("unitCost" >= 0 AND "unitCost" <= 1000000000));

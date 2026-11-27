/**
 * Reparto de lo recibido por una venta en las tres partes que la persona separa:
 * IVA, costo de fabricación y su ganancia. El "neto sin IVA" no es una parte:
 * contiene el costo y la ganancia juntos, por eso no se ofrece como monto a separar.
 */
export type MoneySplit = {
  received: number;
  vat: number;
  cost: number;
  profit: number;
};

export function splitReceived(input: { received: number; vatAmount: number; productionCost: number }): MoneySplit {
  return {
    received: input.received,
    vat: input.vatAmount,
    cost: input.productionCost,
    profit: input.received - input.vatAmount - input.productionCost,
  };
}

/**
 * Anchos enteros (0–100) para la barra del reparto. Suman 100 cuando hay algo recibido;
 * una pérdida no ocupa espacio y el costo absorbe el resto.
 */
export function splitShares(split: MoneySplit): { vat: number; cost: number; profit: number } {
  if (split.received <= 0) return { vat: 0, cost: 0, profit: 0 };
  const percent = (value: number) => Math.max(0, Math.min(100, Math.round((Math.max(0, value) / split.received) * 100)));
  const profit = percent(split.profit);
  const vat = Math.min(100 - profit, percent(split.vat));
  return { vat, cost: 100 - profit - vat, profit };
}

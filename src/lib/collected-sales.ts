/** Movimientos de un pedido que afectan lo efectivamente cobrado. */
export type CollectedMovement = {
  type: "INCOME" | "REFUND";
  amount: number;
  occurredOn: string;
  voided: boolean;
};

/** Reparte unidades mínimas sin perder dinero por redondeo; empates siguen el orden de las líneas. */
export function allocateCollected(amount: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const safeWeights = weights.map((weight) => BigInt(Math.max(0, Math.trunc(weight))));
  let total = safeWeights.reduce((sum, weight) => sum + weight, BigInt(0));
  if (total === BigInt(0)) {
    safeWeights.fill(BigInt(1));
    total = BigInt(weights.length);
  }
  const value = BigInt(Math.abs(Math.trunc(amount)));
  const shares = safeWeights.map((weight, index) => ({ index, value: value * weight / total, remainder: value * weight % total }));
  let rest = value - shares.reduce((sum, share) => sum + share.value, BigInt(0));
  const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const share of ranked) {
    if (rest === BigInt(0)) break;
    share.value += BigInt(1);
    rest -= BigInt(1);
  }
  const sign = amount < 0 ? -1 : 1;
  return shares.map((share) => share.value === BigInt(0) ? 0 : Number(share.value) * sign);
}

/** Reconoce los ingresos y reembolsos en su mes; el costo se reconoce una sola vez. */
export function collectedOrderPeriod(movements: readonly CollectedMovement[], month: string | "all") {
  const valid = movements.filter((movement) => !movement.voided && movement.amount > 0);
  const period = month === "all" ? valid : valid.filter((movement) => movement.occurredOn.startsWith(`${month}-`));
  if (period.length === 0) return null;
  const firstIncome = valid.filter((movement) => movement.type === "INCOME").map((movement) => movement.occurredOn).sort()[0];
  const firstRefund = valid.filter((movement) => movement.type === "REFUND").map((movement) => movement.occurredOn).sort()[0];
  // Una devolución real sin cobro registrado también conserva el costo de fabricación.
  const costDate = firstIncome ?? firstRefund;
  return {
    revenue: period.reduce((sum, movement) => sum + (movement.type === "INCOME" ? movement.amount : -movement.amount), 0),
    recognizeCost: Boolean(costDate && (month === "all" || costDate.startsWith(`${month}-`))),
    activityOn: period.map((movement) => movement.occurredOn).sort().at(-1)!,
  };
}

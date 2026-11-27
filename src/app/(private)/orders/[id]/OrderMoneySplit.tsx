import { Card } from "@/components/ui";
import type { OrderEconomics } from "@/lib/insights";
import { formatMoney } from "@/lib/money-format";
import { splitReceived, splitShares } from "@/lib/money-split";

/** Cómo se reparte lo que recibe el taller por un pedido: IVA, costo de fabricación y ganancia. */
export function OrderMoneySplit({
  economics,
  vatPercent,
  currency,
  paidAmount,
  balance,
  isMercadoLibre,
  className = "",
}: {
  economics: OrderEconomics;
  vatPercent: number;
  currency: string;
  paidAmount: number | null;
  balance: number | null;
  isMercadoLibre: boolean;
  className?: string;
}) {
  const split = splitReceived({
    received: economics.expectedReceivable,
    vatAmount: economics.vatAmount,
    productionCost: economics.productionCost,
  });
  const shares = splitShares(split);
  const isLoss = split.profit < 0;

  const rows = [
    ...(vatPercent > 0
      ? [{ key: "vat", label: `Para el IVA (${vatPercent}%)`, value: split.vat, dot: "bg-faint" }]
      : []),
    { key: "cost", label: "Para costos de fabricación", value: split.cost, dot: "bg-primary" },
  ];

  return (
    <Card className={`p-4 sm:p-6 space-y-3 ${className}`}>
      <div className="space-y-0.5">
        <h2 className="text-base font-bold text-ink">Estimación del pedido completo</h2>
        <p className="text-xs text-muted">
          Sobre <strong className="text-ink tabular-nums">{formatMoney(split.received, currency)}</strong>{" "}
          {isMercadoLibre ? "esperados de Mercado Libre, descontadas las devoluciones" : "esperados, descontadas las devoluciones"}:
        </p>
      </div>

      {paidAmount !== null && (
        <p className="text-xs text-muted">
          <strong className="text-ink">Cobrado hasta ahora: {formatMoney(paidAmount, currency)}</strong> (sin descontar devoluciones).
        </p>
      )}

      {split.received > 0 && (
        <div className="h-2 w-full rounded-full bg-raised overflow-hidden flex" aria-hidden="true">
          {shares.vat > 0 && <div className="h-full bg-faint" style={{ width: `${shares.vat}%` }} />}
          {shares.cost > 0 && <div className="h-full bg-primary" style={{ width: `${shares.cost}%` }} />}
          {shares.profit > 0 && <div className="h-full bg-ok" style={{ width: `${shares.profit}%` }} />}
        </div>
      )}

      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="flex items-baseline justify-between gap-3">
            <dt className="flex items-baseline gap-2 text-muted min-w-0">
              <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${row.dot}`} />
              <span>{row.label}</span>
            </dt>
            <dd className="font-semibold text-ink tabular-nums shrink-0">{formatMoney(row.value, currency)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-line/70 pt-2">
          <dt className="flex items-baseline gap-2 font-bold text-ink">
            <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${isLoss ? "bg-danger" : "bg-ok"}`} />
            <span>{isLoss ? "Pérdida estimada" : "Ganancia estimada"}</span>
          </dt>
          <dd className={`text-base font-bold tabular-nums shrink-0 ${isLoss ? "text-danger" : "text-ok"}`}>
            {formatMoney(split.profit, currency)}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] leading-snug text-muted">
        El reparto es una estimación del pedido completo, no del dinero disponible en tu cuenta.
        {economics.marginPercent !== null && !isLoss && ` Margen: ${economics.marginPercent}% sin IVA.`}
      </p>

      {balance !== null && balance > 0 && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-[11px] text-ink">
          Aún falta cobrar {formatMoney(balance, currency)}. Los importes anteriores no representan un reparto del abono recibido.
        </p>
      )}

      {economics.unitsWithoutCost > 0 && (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-[11px] text-ink">
          {economics.unitsWithoutCost}{" "}
          {economics.unitsWithoutCost === 1 ? "pieza" : "piezas"} sin gramos ni material; su costo no se incluyó.
        </p>
      )}

      {economics.unitsEstimatedToday > 0 && (
        <p className="text-[11px] text-muted">Costo calculado con tarifas actuales del taller.</p>
      )}
    </Card>
  );
}

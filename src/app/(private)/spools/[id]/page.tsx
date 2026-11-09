import Link from "next/link";
import { notFound } from "next/navigation";
import { SpoolDetailEditControls, SpoolQuickConsumeCard } from "@/app/(private)/spools/SpoolControls";
import { Badge, Card } from "@/components/ui";
import { MATERIAL_LABEL, SPOOL_MOVEMENT_LABEL, type SpoolMovementKind } from "@/lib/catalog-presentation";
import { getSpoolDetail } from "@/lib/spool-queries";
import { formatDay } from "@/lib/date-labels";

export const metadata = {
  title: "Detalle de Bobina · Kalibre",
};

type Params = Promise<{ id: string }>;

export default async function SpoolDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const spool = await getSpoolDetail(id);
  if (!spool) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 sm:pb-10">
      <div className="flex items-center justify-between gap-2">
        <Link href="/spools" className="text-xs font-semibold text-muted hover:text-ink">
          ← Volver a bobinas
        </Link>
        <span className="text-xs text-muted">Comprada el {formatDay(spool.purchasedOn)}</span>
      </div>

      <SpoolQuickConsumeCard
        spool={spool}
        currency={spool.currency}
        canOperate={spool.canOperate}
      />

      {spool.notes && (
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Notas</div>
          <p className="mt-1 text-sm">{spool.notes}</p>
        </Card>
      )}

      {spool.canManageCatalog && (
        <SpoolDetailEditControls spool={spool} currency={spool.currency} />
      )}

      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Historial de movimientos ({spool.movements.length})
          </h2>
          <Badge tone="neutral">
            {MATERIAL_LABEL[spool.material as keyof typeof MATERIAL_LABEL] ?? spool.material}
          </Badge>
        </div>

        {spool.movements.length === 0 ? (
          <p className="text-sm text-muted">Sin movimientos registrados.</p>
        ) : (
          <div className="divide-y divide-line">
            {spool.movements.map((mov) => (
              <div key={mov.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">
                      {SPOOL_MOVEMENT_LABEL[mov.kind as SpoolMovementKind] ?? mov.kind}
                    </span>
                    {mov.orderId && mov.orderNumber !== null && (
                      <Link
                        href={`/orders/${mov.orderId}`}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Pedido #{mov.orderNumber}
                      </Link>
                    )}
                  </div>
                  {mov.notes && <p className="text-xs text-muted truncate">{mov.notes}</p>}
                  <p className="text-[11px] text-muted">
                    {new Date(mov.createdAt).toLocaleString("es-CL")} · {mov.actorName}
                  </p>
                </div>

                <div className="text-right shrink-0 tabular-nums">
                  <div
                    className={`text-sm font-bold ${
                      mov.deltaGrams < 0 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {mov.deltaGrams > 0 ? `+${mov.deltaGrams}` : mov.deltaGrams} g
                  </div>
                  <div className="text-xs text-muted">Quedan {mov.resultingGrams} g</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

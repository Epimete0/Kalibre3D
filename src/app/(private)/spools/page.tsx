import Link from "next/link";
import { SpoolCreateModal, SpoolQuickConsumeCard } from "@/app/(private)/spools/SpoolControls";
import { Badge, Card } from "@/components/ui";
import { MATERIALS, MATERIAL_LABEL } from "@/lib/catalog-presentation";
import { formatMoney } from "@/lib/money-format";
import { listSpools } from "@/lib/spool-queries";

export const metadata = {
  title: "Bobinas y Filamento · Kalibre",
};

type SearchParams = Promise<{
  material?: string;
  inactive?: string;
  low?: string;
}>;

export default async function SpoolsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const materialFilter = params.material ?? "ALL";
  const includeInactive = params.inactive === "1";
  const onlyLow = params.low === "1";

  const view = await listSpools({
    material: materialFilter,
    includeInactive,
    onlyLow,
  });

  const totalRemainingGrams = view.spools
    .filter((s) => s.active)
    .reduce((acc, s) => acc + s.remainingGrams, 0);
  const lowCount = view.spools.filter((s) => s.isLow).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 sm:pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Bobinas de filamento</h1>
          <p className="text-sm text-muted">
            Control de gramos disponibles por material y color, y costo promedio real para cotizar.
          </p>
        </div>

        {view.canManageCatalog && (
          <SpoolCreateModal
            currency={view.currency}
            defaultCostPerKg={view.defaultCostPerKg}
          />
        )}
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3.5">
          <div className="text-xs font-medium text-muted">Bobinas activas</div>
          <div className="mt-1 text-xl font-bold tabular-nums">
            {view.spools.filter((s) => s.active).length}
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs font-medium text-muted">Filamento disponible</div>
          <div className="mt-1 text-xl font-bold tabular-nums">
            {totalRemainingGrams.toLocaleString("es-CL")} g
          </div>
        </Card>
        <Card className="p-3.5">
          <div className="text-xs font-medium text-muted">Con poco filamento</div>
          <div className={`mt-1 text-xl font-bold tabular-nums ${lowCount > 0 ? "text-amber-600" : ""}`}>
            {lowCount}
          </div>
          <div className="text-[11px] text-muted">≤ {view.lowSpoolThresholdGrams} g</div>
        </Card>
        {view.canSeeMoney && (
          <Card className="p-3.5">
            <div className="text-xs font-medium text-muted">Costo PETG actual</div>
            <div className="mt-1 text-xl font-bold tabular-nums">
              {formatMoney(Math.round((view.materialCostPerGram["PETG"] ?? 15) * 1000), view.currency)}/kg
            </div>
            <div className="text-[11px] text-muted">
              ~{formatMoney(Math.round(view.materialCostPerGram["PETG"] ?? 15), view.currency)}/g
            </div>
          </Card>
        )}
      </div>

      {/* Filtros táctiles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Link
            href={`/spools?material=ALL${includeInactive ? "&inactive=1" : ""}${onlyLow ? "&low=1" : ""}`}
            className={`min-h-[36px] inline-flex items-center rounded-full px-3 text-xs font-semibold ${
              materialFilter === "ALL"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            Todos
          </Link>
          {MATERIALS.map((mat) => (
            <Link
              key={mat}
              href={`/spools?material=${mat}${includeInactive ? "&inactive=1" : ""}${onlyLow ? "&low=1" : ""}`}
              className={`min-h-[36px] inline-flex items-center rounded-full px-3 text-xs font-semibold ${
                materialFilter === mat
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              {MATERIAL_LABEL[mat]}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Link
            href={`/spools?material=${materialFilter}&low=${onlyLow ? "0" : "1"}${includeInactive ? "&inactive=1" : ""}`}
            className={`min-h-[36px] inline-flex items-center rounded-lg border px-2.5 font-medium ${
              onlyLow ? "border-amber-500/50 bg-amber-500/10 text-amber-700" : "border-border text-muted hover:text-foreground"
            }`}
          >
            Solo poco filamento
          </Link>
          <Link
            href={`/spools?material=${materialFilter}&inactive=${includeInactive ? "0" : "1"}${onlyLow ? "&low=1" : ""}`}
            className={`min-h-[36px] inline-flex items-center rounded-lg border px-2.5 font-medium ${
              includeInactive ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground"
            }`}
          >
            {includeInactive ? "Ocultar inactivas" : "Ver inactivas"}
          </Link>
        </div>
      </div>

      {/* Lista de bobinas */}
      {view.spools.length === 0 ? (
        <Card className="p-8 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">No hay bobinas para este filtro.</p>
          <p className="text-xs text-muted">
            Registra tus bobinas para controlar cuántos gramos quedan y calcular el costo real por material.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {view.spools.map((spool) => (
            <SpoolQuickConsumeCard
              key={spool.id}
              spool={spool}
              currency={view.currency}
              canOperate={view.canOperate}
            />
          ))}
        </div>
      )}

      {view.canSeeMoney && (
        <Card className="p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5">
            Costo promedio por material (bobinas activas)
          </h2>
          <div className="flex flex-wrap gap-2">
            {MATERIALS.map((m) => (
              <Badge key={m} tone="neutral">
                {MATERIAL_LABEL[m]}: {formatMoney(Math.round((view.materialCostPerGram[m] ?? 15) * 1000), view.currency)}/kg
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

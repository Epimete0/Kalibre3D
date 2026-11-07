import { Card, LinkButton, PageHeader } from "@/components/ui";
import { requireAuthContext } from "@/lib/auth";
import { MATERIALS, type Material } from "@/lib/catalog-presentation";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listCustomers } from "@/lib/customer-queries";
import { listSpools } from "@/lib/spool-queries";
import { QuoteCalculator, type MaterialRateInfo } from "./QuoteCalculator";

export default async function QuotePage() {
  const { role } = await requireAuthContext();

  if (role === "VIEWER") {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Cotizador de piezas"
          description="Cálculo de costos de impresión 3D, márgenes y precios sugeridos."
        />
        <Card className="p-5 text-sm text-muted">
          Tu perfil de solo lectura no tiene acceso al cotizador de costos y márgenes del taller.
        </Card>
      </div>
    );
  }

  const [settings, spoolsView, customers] = await Promise.all([
    getCenterSettings(),
    listSpools({ includeInactive: false }),
    listCustomers({ includeInactive: false }),
  ]);

  const materialRates = {} as Record<Material, MaterialRateInfo>;

  for (const mat of MATERIALS) {
    const activeOfMat = spoolsView.spools.filter((s) => s.active && s.material === mat);
    const costPerGram =
      spoolsView.materialCostPerGram[mat] ?? settings.defaultCostPerKg / 1000;
    const totalRemainingGrams = activeOfMat.reduce((acc, s) => acc + s.remainingGrams, 0);

    materialRates[mat] = {
      material: mat,
      costPerGram,
      activeSpoolsCount: activeOfMat.length,
      totalRemainingGrams,
    };
  }

  const canEditCatalog = role === "OWNER" || role === "ADMIN";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cotizador de piezas 3D"
        description="Calcula costos reales de filamento, purga multicolor, electricidad y comisión de Mercado Libre."
      >
        <div className="flex items-center gap-2">
          <LinkButton href="/spools" variant="ghost">
            Ver bobinas
          </LinkButton>
          <LinkButton href="/products" variant="ghost">
            Ver catálogo
          </LinkButton>
        </div>
      </PageHeader>

      <QuoteCalculator
        currency={settings.currency}
        electricityCostPerHour={settings.electricityCostPerHour}
        defaultPackagingCost={settings.defaultPackagingCost}
        defaultPurgeGrams={settings.defaultPurgeGrams}
        mlCommissionPercent={settings.mlCommissionPercent}
        mlDefaultShippingCost={settings.mlDefaultShippingCost}
        vatPercent={settings.vatPercent}
        extraCommissionPercent={settings.extraCommissionPercent}
        defaultMarginPercent={settings.defaultMarginPercent}
        materialRates={materialRates}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          instagram: c.instagram,
        }))}
        canEditCatalog={canEditCatalog}
      />
    </div>
  );
}

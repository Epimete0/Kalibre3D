import { NoPermission } from "@/components/NoPermission";
import { LinkButton, PageHeader } from "@/components/ui";
import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listProducts } from "@/lib/product-queries";
import { listSpools } from "@/lib/spool-queries";
import { CreateProductBar, ProductList } from "./ProductControls";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const auth = await requireAuthContext();
  if (!canManageCatalog(auth.role)) {
    return (
      <NoPermission
        action="administrar el catálogo de piezas"
        backHref="/dashboard"
        backLabel="Volver al inicio"
      />
    );
  }

  const [settings, products, spoolsView] = await Promise.all([
    getCenterSettings(),
    listProducts({ includeInactive: true }),
    listSpools({ includeInactive: false }),
  ]);

  return (
    <>
      <PageHeader
        title="Catálogo de piezas y stock"
        description="Las piezas que vendes seguido, con su precio y cuántas tienes listas."
      >
        <LinkButton href="/quote" variant="ghost">
          Cotizar pieza
        </LinkButton>
      </PageHeader>
      <div className="max-w-5xl pb-20 sm:pb-8">
        <CreateProductBar
          currency={settings.currency}
          defaultPurgeGrams={settings.defaultPurgeGrams}
          sellsOnMercadoLibre={settings.mlCommissionPercent > 0 || settings.mlDefaultShippingCost > 0}
        />
        <ProductList
          products={products}
          currency={settings.currency}
          costSummary={{
            currency: settings.currency,
            electricityCostPerHour: settings.electricityCostPerHour,
            defaultPackagingCost: settings.defaultPackagingCost,
            defaultPurgeGrams: settings.defaultPurgeGrams,
            mlCommissionPercent: Number(settings.mlCommissionPercent),
            mlDefaultShippingCost: settings.mlDefaultShippingCost,
            materialCostPerGram: spoolsView.materialCostPerGram,
          }}
        />
      </div>
    </>
  );
}

import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { listProducts } from "@/lib/product-queries";
import { PageHeader } from "@/components/ui";
import { NoPermission } from "@/components/NoPermission";
import { CreateProductBar, ProductList } from "./ProductControls";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const auth = await requireAuthContext();
  if (!canManageCatalog(auth.role)) {
    return (
      <NoPermission
        action="administrar la lista de precios"
        backHref="/dashboard"
        backLabel="Volver al inicio"
      />
    );
  }

  const [settings, products] = await Promise.all([
    getCenterSettings(),
    listProducts({ includeInactive: true }),
  ]);

  return (
    <>
      <PageHeader
        title="Lista de precios"
        description="Piezas habituales y precios de venta directos y en Mercado Libre para agilizar tus pedidos."
      />
      <div className="max-w-5xl">
        <CreateProductBar currency={settings.currency} />
        <ProductList products={products} currency={settings.currency} />
      </div>
    </>
  );
}

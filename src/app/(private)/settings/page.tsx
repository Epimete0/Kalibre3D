import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { PageHeader } from "@/components/ui";
import { NoPermission } from "@/components/NoPermission";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireAuthContext();
  if (!canManageCatalog(auth.role)) {
    return (
      <NoPermission
        action="modificar los ajustes del taller"
        backHref="/dashboard"
        backLabel="Volver al inicio"
      />
    );
  }

  const settings = await getCenterSettings();

  return (
    <>
      <PageHeader
        title="Ajustes del taller"
        description="Configuración de moneda, zona horaria, comisión de Mercado Libre y parámetros de costos."
      />
      <div className="max-w-4xl">
        <SettingsForm settings={settings} />
      </div>
    </>
  );
}

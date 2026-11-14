import { canManageCatalog, requireAuthContext } from "@/lib/auth";
import { getCenterSettings } from "@/lib/center-settings-service";
import { PageHeader } from "@/components/ui";
import { NoPermission } from "@/components/NoPermission";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage(props: { searchParams?: Promise<{ bienvenida?: string }> }) {
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
  const welcome = (props.searchParams ? await props.searchParams : {}).bienvenida === "1";

  return (
    <>
      {welcome ? (
        <PageHeader
          title="Prepara tu taller"
          description="Paso 1 de 3 · Tus costos. Después agregas tu primera bobina y registras tu primera venta."
        />
      ) : (
        <h1 className="sr-only">Mis costos</h1>
      )}
      <div className="max-w-3xl">
        <SettingsForm settings={settings} welcome={welcome} />
      </div>
    </>
  );
}

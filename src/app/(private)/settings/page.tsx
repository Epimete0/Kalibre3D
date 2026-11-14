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
          title="Armemos Kalibre a tu medida"
          description="Elige qué herramientas necesitas hoy y ajusta tus costos básicos. Puedes activar o desactivar cualquier módulo después."
        />
      ) : (
        <h1 className="sr-only">Mis costos y módulos del taller</h1>
      )}
      <div className="max-w-3xl">
        <SettingsForm settings={settings} welcome={welcome} />
      </div>
    </>
  );
}

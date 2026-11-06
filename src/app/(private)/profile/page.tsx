import Link from "next/link";
import { canManageCatalog, getSessionMembershipState } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type TeamRole } from "@/lib/team-rules";
import { Badge, Card, PageHeader } from "@/components/ui";
import { CenterForm, DisplayNameForm, EmailForm, PasswordForm, SwitchCenterForm } from "./AccountForms";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // Esta pantalla tolera a una persona sin taller (solo ve su cuenta y cómo unirse con un código).
  const state = await getSessionMembershipState();
  const active = state.activeContext;
  const canManage = active ? canManageCatalog(active.role) : false;
  const { data } = await (await createSupabaseServerClient()).auth.getUser();
  const email = data.user?.email ?? "Sin correo";
  const pendingEmail = data.user?.new_email ?? null;
  const activeCenter = active ? state.memberships.find((membership) => membership.centerId === active.centerId)?.center : undefined;

  const account = (
    <Card className="min-w-0 p-5 lg:col-span-5">
      <h2 className="font-display text-xl text-ink">Mi cuenta</h2>
      <dl className="mt-3 text-sm"><dt className="text-faint">Correo</dt><dd data-testid="account-email" className="text-ink [overflow-wrap:anywhere]">{email}</dd></dl>
      <div className="mt-4 border-t border-line pt-4"><h3 className="mb-3 text-sm font-semibold text-ink">Cambiar correo de acceso</h3><EmailForm currentEmail={data.user?.email ?? ""} pendingEmail={pendingEmail} /></div>
      <div className="mt-5 border-t border-line pt-4"><DisplayNameForm initial={state.profile?.displayName ?? ""} /></div>
      <div className="mt-5 border-t border-line pt-4"><h3 className="mb-3 text-sm font-semibold text-ink">Cambiar contraseña</h3><PasswordForm /></div>
    </Card>
  );

  if (!active) {
    return <>
      <PageHeader title="Configuración" description="Tu cuenta y tu taller." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        {account}
        <Card className="min-w-0 p-5 lg:col-span-7">
          <h2 className="font-display text-xl text-ink">Aún no tienes un taller activo</h2>
          <p className="mt-1 text-sm text-faint">Para trabajar en un taller, pídele a quien administra el taller un código de invitación.</p>
          <Link href="/join" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2">Tengo un código de invitación</Link>
        </Card>
      </div>
    </>;
  }

  const myCenters = state.memberships.map((membership) => ({ id: membership.centerId, name: membership.center.name }));
  const centerCard = (
    <Card id="mi-taller" className="min-w-0 scroll-mt-24 p-5 lg:col-span-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl text-ink">Mi taller</h2><Badge tone="accent">Tu rol: {ROLE_LABEL[active.role as TeamRole]}</Badge></div>
      {canManage ? <div className="mt-3"><CenterForm name={activeCenter?.name ?? ""} timeZone={active.timeZone ?? ""} nameLockedUntil={null} /></div> : (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-faint">Taller</dt><dd data-testid="center-readonly-name" className="text-ink [overflow-wrap:anywhere]">{activeCenter?.name}</dd></div>
          <div><dt className="text-faint">Zona horaria</dt><dd className="text-ink">{active.timeZone ?? "Sin definir"}</dd></div>
        </dl>
      )}
      {myCenters.length > 1 ? <div className="mt-5 border-t border-line pt-4"><SwitchCenterForm centers={myCenters} current={active.centerId} /></div> : null}
    </Card>
  );

  return <>
    <PageHeader title="Configuración" description="Tu cuenta y los datos de tu taller." />
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      {account}
      {centerCard}
    </div>
  </>;
}

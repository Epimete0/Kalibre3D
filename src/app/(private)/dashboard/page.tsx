import { Card, LinkButton, PageHeader } from "@/components/ui";
import { getSessionMembershipState } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const membershipState = await getSessionMembershipState();
  const active = membershipState.activeContext;
  if (!active) {
    return <>
      <PageHeader title="Comienza en Taller 3D" description="Crea tu propio taller o únete al de tu equipo con un código de invitación." />
      <Card className="max-w-2xl p-6">
        <h2 className="text-xl text-ink">Aún no tienes un taller activo</h2>
        <p className="mt-2 text-sm text-muted">Si este es tu negocio, créalo en un minuto. Si trabajas en el taller de otra persona, pídele su código de invitación.</p>
        <div className="mt-5 flex flex-wrap gap-3"><LinkButton href="/taller/nuevo">Crear mi taller</LinkButton><LinkButton href="/join" variant="ghost">Tengo un código de invitación</LinkButton></div>
      </Card>
    </>;
  }

  const centerName = membershipState.memberships.find((membership) => membership.centerId === active.centerId)?.center.name;
  const name = membershipState.profile?.displayName?.split(" ")[0];
  return <>
    <PageHeader title={name ? `Hola, ${name}` : "Hola"} description={centerName ? `Este es el inicio de ${centerName}.` : "Este es el inicio de tu taller."} />
    <Card className="max-w-2xl p-6">
      <h2 className="text-xl text-ink">Tu taller ya está listo</h2>
      <p className="mt-2 text-sm text-muted">Pronto podrás registrar aquí tus pedidos, el dinero que entra y sale, los costos de cada pieza y tu filamento. Mientras tanto, revisa los datos de tu taller.</p>
      <div className="mt-5 flex flex-wrap gap-3"><LinkButton href="/profile">Ir a Mi taller</LinkButton></div>
    </Card>
  </>;
}

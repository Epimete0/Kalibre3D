import { requireAuthContext } from "@/lib/auth";
import { listInvitations } from "@/lib/invitation-admin-service";
import { listTeam } from "@/lib/member-service";
import { INVITATION_LABEL, ROLE_LABEL, canToggleActive, invitableRoles, roleOptionsFor, type TeamRole } from "@/lib/team-rules";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActiveButton, ChangeRoleDialog, InviteDialog, RevokeButton } from "./TeamControls";

export const dynamic = "force-dynamic";

const ROLE_TONE: Record<TeamRole, "accent" | "ok" | "neutral"> = { OWNER: "accent", ADMIN: "accent", PROFESSIONAL: "ok", VIEWER: "neutral" };
const STATUS_TONE = { ACTIVE: "ok", REDEEMED: "neutral", REVOKED: "neutral", EXPIRED: "warn" } as const;
const day = (date: Date) => date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "•";

export default async function TeamPage() {
  const context = await requireAuthContext();
  const canManage = context.role === "OWNER" || context.role === "ADMIN";
  const [team, invitations] = await Promise.all([listTeam(), canManage ? listInvitations() : Promise.resolve([])]);
  const actor = { userId: context.userId, role: context.role as TeamRole };
  const roles = invitableRoles(actor.role);
  const soleOwner = team.members.filter((member) => member.active && member.role === "OWNER").length === 1;

  return <>
    <PageHeader title="Equipo" description="Las personas del taller, lo que puede hacer cada una y quién puede sumarse.">
      {canManage && roles.length ? <InviteDialog roles={roles} /> : null}
    </PageHeader>

    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
      <Card className="min-w-0 overflow-hidden lg:col-span-7">
        <div className="border-b border-line px-5 py-3.5"><h2 className="font-display text-xl text-ink">Personas</h2><p className="text-sm text-faint">{team.members.filter((m) => m.active).length} activas{team.members.some((m) => !m.active) ? ` · ${team.members.filter((m) => !m.active).length} desactivadas` : ""}</p></div>
        <ul data-testid="team-members" className="divide-y divide-line/70">
          {team.members.map((member) => {
            const target = { userId: member.userId, role: member.role, active: member.active };
            // El único dueño activo no se baja de rol ni se desactiva: el taller siempre conserva uno.
            const protectedOwner = soleOwner && member.active && member.role === "OWNER";
            const options = canManage && !protectedOwner ? roleOptionsFor(actor, target) : [];
            const toggle = canManage && !protectedOwner && canToggleActive(actor, target);
            return (
              <li key={member.userId} data-member={member.userId} className="flex flex-col gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${member.active ? "bg-primary-soft text-primary" : "bg-canvas text-faint"}`}>{initials(member.name)}</div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-medium [overflow-wrap:anywhere] ${member.active ? "text-ink" : "text-faint"}`}>{member.name}{member.userId === context.userId ? <span className="ml-1.5 text-xs font-normal text-faint">(tú)</span> : null}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={member.active ? ROLE_TONE[member.role] : "neutral"}>{ROLE_LABEL[member.role]}</Badge>
                      {!member.active ? <Badge tone="neutral">Desactivada</Badge> : null}
                    </div>
                  </div>
                </div>
                {options.length || toggle ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {options.length ? <ChangeRoleDialog userId={member.userId} name={member.name} options={options} /> : null}
                    {toggle ? <ActiveButton userId={member.userId} name={member.name} active={member.active} /> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {canManage ? (
        <Card className="min-w-0 overflow-hidden lg:col-span-5">
          <div className="border-b border-line px-5 py-3.5"><h2 className="font-display text-xl text-ink">Invitaciones</h2><p className="text-sm text-faint">Códigos de un solo uso, vigentes por 7 días.</p></div>
          {invitations.length ? (
            <ul data-testid="invitations" className="divide-y divide-line/70">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">{ROLE_LABEL[invitation.role]}</p>
                    <p className="text-xs text-faint">Creada el {day(invitation.createdAt)}{invitation.status === "ACTIVE" ? ` · vence el ${day(invitation.expiresAt)}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[invitation.status]}>{INVITATION_LABEL[invitation.status]}</Badge>
                    {invitation.status === "ACTIVE" ? <RevokeButton id={invitation.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : <div data-testid="invitations-empty"><EmptyState title="Sin invitaciones" description="Crea un código para que alguien se una al taller." /></div>}
        </Card>
      ) : null}
    </div>
  </>;
}

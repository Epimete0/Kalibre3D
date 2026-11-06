import Link from "next/link";
import { Card } from "@/components/ui";

/** Aviso claro cuando el rol no permite la acción, en vez de caer en la pantalla de error. */
export function NoPermission({ action, backHref, backLabel }: { action: string; backHref: string; backLabel: string }) {
  return (
    <div className="max-w-2xl">
      <Card className="p-6 sm:p-8">
        <h1 className="font-display text-2xl text-ink">No tienes permisos para {action}</h1>
        <p className="mt-2 text-sm leading-6 text-faint">Tu rol en este taller no permite hacerlo. Si lo necesitas, pídele a quien administra el taller que ajuste tus permisos.</p>
        <Link href={backHref} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-raised px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 touch-manipulation">{backLabel}</Link>
      </Card>
    </div>
  );
}

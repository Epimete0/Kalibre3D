import type { ReactNode } from "react";
import { LEGAL_CONTACT_EMAIL, LEGAL_REVIEWED, TERMS_VERSION_LABEL } from "@/lib/legal";
import { PublicShell } from "@/components/PublicShell";

/** Estructura común de los documentos legales: título, versión, aviso de borrador y secciones numeradas. */
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <PublicShell>
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Taller 3D</p>
        <h1 className="mt-2 text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-faint">Versión del {TERMS_VERSION_LABEL}</p>
        {!LEGAL_REVIEWED ? <p role="note" data-testid="legal-draft" className="mt-5 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-ink">Este texto es un borrador pendiente de revisión legal. Puede cambiar antes de la publicación del servicio.</p> : null}
        <p className="mt-6 text-lg leading-relaxed text-muted">{intro}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-7 text-ink [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_li]:mt-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
        {LEGAL_CONTACT_EMAIL ? <p className="mt-12 border-t border-line pt-6 text-sm text-faint">¿Dudas sobre este documento? Escríbenos a <a className="font-medium text-primary underline underline-offset-2" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.</p> : null}
      </main>
    </PublicShell>
  );
}

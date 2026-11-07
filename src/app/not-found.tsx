import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";

export const metadata: Metadata = { title: "Página no encontrada — Kalibre" };

/** «No encontrado» para cualquier dirección que no existe fuera del área privada. En español y con una salida clara. */
export default function NotFound() {
  return (
    <PublicShell>
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Error 404</p>
        <h1 className="mt-3 text-balance font-display text-4xl leading-tight text-ink sm:text-5xl">No encontramos esta página</h1>
        <p className="mt-4 text-muted">Puede que la dirección esté mal escrita o que la página ya no exista.</p>
        <Link href="/" className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2">Volver al inicio</Link>
      </main>
    </PublicShell>
  );
}

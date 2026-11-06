"use client";

import Link from "next/link";

/** Error inesperado fuera del área privada. Nunca muestra el detalle técnico: solo una salida clara. */
export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Taller 3D</p>
      <h1 className="mt-3 text-balance font-display text-4xl leading-tight text-ink">Algo salió mal</h1>
      <p className="mt-4 text-muted">No fue posible mostrar esta página. Intenta nuevamente; si el problema continúa, vuelve más tarde.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2">Reintentar</button>
        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-raised px-6 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Ir al inicio</Link>
      </div>
    </main>
  );
}

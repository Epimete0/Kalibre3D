import Link from "next/link";

/** Portada provisional: propuesta de valor y acceso. La landing definitiva llega con la marca. */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-ink">
      <div className="max-w-md space-y-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Taller 3D</h1>
        <p className="text-base text-muted sm:text-lg">Pedidos, dinero, costos y filamento de tu taller de impresión 3D en un solo lugar.</p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Link href="/registro" className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2">Crear mi cuenta</Link>
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2">Iniciar sesión</Link>
        </div>
      </div>
    </main>
  );
}

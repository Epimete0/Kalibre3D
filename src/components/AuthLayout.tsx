import Link from "next/link";

const trust = [
  "Costo promedio ponderado, siempre al día",
  "Historial de movimientos inmutable",
  "Cuentas y roles verificados por taller",
];

/**
 * Shared split-screen shell for the public access routes (login, forgot,
 * reset). A branded sage panel echoes the landing on large screens; on mobile
 * it collapses to the form with a compact brand header.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-w-0 max-w-full min-h-screen overflow-x-clip lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Brand panel — large screens only */}
      <aside className="relative hidden overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div
          aria-hidden
          className="ambient-float pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
        />

        <Link
          href="/"
          className="reveal relative font-display text-2xl tracking-tight text-white"
        >
          Kalibre<span className="text-accent">.</span>
        </Link>

        <div className="relative max-w-md">
          <p
            className="reveal text-xs font-medium uppercase tracking-[0.2em] text-white/60"
            style={{ animationDelay: "60ms" }}
          >
            Operación con trazabilidad
          </p>
          <h2
            className="reveal mt-5 font-display text-4xl leading-[1.05] text-white"
            style={{ animationDelay: "140ms" }}
          >
            Cada insumo cuenta la <span className="italic text-accent">historia</span> de
            tu taller.
          </h2>
          <p
            className="reveal mt-5 text-[0.95rem] leading-relaxed text-white/70"
            style={{ animationDelay: "220ms" }}
          >
            Compras, costo promedio, consumos y utilidad conectados en un solo lugar.
          </p>
        </div>

        <ul
          className="reveal relative space-y-3 text-sm text-white/85"
          style={{ animationDelay: "300ms" }}
        >
          {trust.map((t) => (
            <li key={t} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {t}
            </li>
          ))}
        </ul>
      </aside>

      {/* Form side */}
      <div className="relative flex min-w-0 max-w-full min-h-screen flex-col items-center justify-center px-5 py-12 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-10 -z-10 h-80 w-80 rounded-full bg-primary-soft/50 blur-3xl lg:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-10 -z-10 h-80 w-80 rounded-full bg-accent-soft/50 blur-3xl lg:hidden"
        />
        <div className="min-w-0 w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-block font-display text-2xl tracking-tight text-ink lg:hidden"
          >
            Kalibre<span className="text-accent">.</span>
          </Link>
          <div className="reveal" style={{ animationDelay: "120ms" }}>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

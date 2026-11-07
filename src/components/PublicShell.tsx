import Link from "next/link";

function KalibreMark({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-lg border border-slate-700/80 bg-slate-900 text-primary shadow-sm ${
        small ? "h-6 w-6" : "h-8 w-8"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={small ? "h-3.5 w-3.5" : "h-4.5 w-4.5"}
      >
        {/* Caliper jaws + nozzle extrusion tip */}
        <path d="M5 4v16" />
        <path d="M5 6h10l3 3h-6" />
        <path d="M5 14h8l2 2H5" />
        <circle cx="17" cy="17" r="2" className="text-sky-400" stroke="currentColor" />
      </svg>
    </span>
  );
}

export function PublicHeader({ showHowItWorks = false }: { showHowItWorks?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-10 lg:px-16">
        <Link href="/" className="inline-flex items-center gap-2.5 font-display text-xl font-bold tracking-tight text-ink">
          <KalibreMark />
          <span>
            Kalibre<span className="ml-1 rounded bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">3D</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-3" aria-label="Navegación pública">
          {showHowItWorks ? (
            <>
              <a href="#pilares" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink md:inline-block">
                Módulos
              </a>
              <a href="#cotizador-real" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink md:inline-block">
                Mercado Libre y Costos
              </a>
              <a href="#flujo" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-ink md:inline-block">
                Flujo de taller
              </a>
            </>
          ) : null}
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface hover:text-ink">
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
          >
            <span className="sm:hidden">Crear cuenta</span>
            <span className="hidden sm:inline">Abrir mi taller</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-10 lg:px-16">
        <div className="flex items-center gap-2.5 font-display text-base font-bold text-ink">
          <KalibreMark small />
          <span>Kalibre</span>
          <span className="font-mono text-xs font-normal text-faint">· Precisión para talleres 3D</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            Inicio
          </Link>
          <Link href="/login" className="text-muted hover:text-ink">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="text-muted hover:text-ink">
            Crear mi taller
          </Link>
          <Link href="/terminos" className="text-muted hover:text-ink">
            Términos
          </Link>
          <Link href="/privacidad" className="text-muted hover:text-ink">
            Privacidad
          </Link>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children, showHowItWorks }: { children: React.ReactNode; showHowItWorks?: boolean }) {
  return (
    <div className={`public-shell ${showHowItWorks ? "public-shell-light" : ""} flex min-h-screen flex-col`}>
      <PublicHeader showHowItWorks={showHowItWorks} />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}

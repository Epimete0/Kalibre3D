import Link from "next/link";

function KalibreMark({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded-lg border border-[#2a2c33] bg-[#1c1d21] text-[#f5f2eb] shadow-sm ${
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
        <circle cx="17" cy="17" r="2" className="text-[#60a5fa]" stroke="currentColor" />
      </svg>
    </span>
  );
}

export function PublicHeader({ showHowItWorks = false }: { showHowItWorks?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-10 lg:px-12">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-xl font-bold tracking-tight text-ink">
          <KalibreMark />
          <span>
            Kalibre<span className="ml-1 rounded border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink">3D</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Navegación pública">
          {showHowItWorks ? (
            <>
              <Link href="/#pilares" className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-raised/70 hover:text-ink lg:inline-block">
                Módulos
              </Link>
              <Link href="/#cotizador-real" className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-raised/70 hover:text-ink lg:inline-block">
                Canales y ML
              </Link>
              <Link href="/#flujo" className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium text-muted transition-colors hover:bg-raised/70 hover:text-ink xl:inline-block">
                Cómo funciona
              </Link>
            </>
          ) : null}
          <Link
            href="/herramientas/cotizador"
            className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-raised/70 hover:text-ink sm:px-3 sm:py-2 sm:text-sm sm:font-medium"
          >
            Cotizador gratis
          </Link>
          <Link href="/login" className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-raised/70 hover:text-ink sm:px-3 sm:py-2 sm:text-sm">
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(28,29,33,0.12),0_4px_12px_color-mix(in_srgb,var(--color-primary)_26%,transparent)] transition-colors hover:bg-primary-hover sm:min-h-10 sm:px-4 sm:py-2 sm:text-sm"
          >
            <span className="sm:hidden">Crear</span>
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
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-10 lg:px-12">
        <div className="flex items-center gap-2.5 font-display text-base font-bold text-ink">
          <KalibreMark small />
          <span>Kalibre</span>
          <span className="font-mono text-xs font-normal text-faint">· Precisión para talleres 3D</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href="/" className="text-muted hover:text-ink">
            Inicio
          </Link>
          <Link href="/herramientas/cotizador" className="text-muted hover:text-ink">
            Cotizador gratis
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

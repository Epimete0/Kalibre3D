import Link from "next/link";

export function PublicHeader({ showHowItWorks = false }: { showHowItWorks?: boolean }) {
  return (
    <header className={`landing-header sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur-md ${showHowItWorks ? "landing-header-home" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-10 lg:px-16">
        <Link href="/" className="landing-logo font-display text-2xl tracking-tight text-ink"><span className="landing-logo-mark" aria-hidden="true" />Kalibre</Link>
        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Navegación pública">
          {showHowItWorks ? <><a href="#pilares" className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:inline-block">Producto</a><a href="#flujo" className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:inline-block">Cómo funciona</a></> : null}
          <Link href="/login" className="rounded-full px-2 py-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:px-3">Iniciar sesión</Link>
          <Link href="/registro" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover"><span className="sm:hidden">Crear cuenta</span><span className="hidden sm:inline">Crear mi taller</span></Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return <footer className="border-t border-line"><div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-10 lg:px-16"><p className="landing-logo font-display text-lg text-ink"><span className="landing-logo-mark landing-logo-mark-small" aria-hidden="true" />Kalibre</p><div className="flex items-center gap-4 text-sm"><Link href="/" className="text-faint hover:text-ink">Inicio</Link><Link href="/login" className="text-faint hover:text-ink">Iniciar sesión</Link><Link href="/registro" className="text-faint hover:text-ink">Crear mi taller</Link><Link href="/terminos" className="text-faint hover:text-ink">Términos</Link><Link href="/privacidad" className="text-faint hover:text-ink">Privacidad</Link></div><p className="text-sm text-faint">Gestión de pedidos, dinero y filamento para talleres de impresión 3D.</p></div></footer>;
}

export function PublicShell({ children, showHowItWorks }: { children: React.ReactNode; showHowItWorks?: boolean }) {
  return <div className={`public-shell ${showHowItWorks ? "public-shell-light" : ""} min-h-screen`}><PublicHeader showHowItWorks={showHowItWorks} />{children}<PublicFooter /></div>;
}

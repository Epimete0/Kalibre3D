import Link from "next/link";

const specs = [
  {
    code: "ML-NET",
    title: "Neto real de Mercado Libre",
    detail: "Descuenta comisión y envío a tu cargo antes de fabricar.",
  },
  {
    code: "AMS-PURGE",
    title: "Costeo al gramo con purga multicolor",
    detail: "Calcula filamento de pieza + purga + horas de luz + embalaje.",
  },
  {
    code: "SPOOL-LOCK",
    title: "Bobinas y stock con historial inmutable",
    detail: "Alertas de bobina por acabarse y control por rol en tu taller.",
  },
];

/**
 * Shell de acceso público (login, registro, recuperar contraseña y crear taller).
 * Panel izquierdo inspirado en una cama PEI de carbono con escala vernier y telemetría de taller 3D.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen min-w-0 max-w-full overflow-x-clip lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      {/* Panel técnico — escritorio */}
      <aside className="kalibre-dark-grid relative hidden overflow-hidden border-r border-slate-800 text-slate-100 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        {/* Escala milimétrica superior estilo pie de rey */}
        <div>
          <div className="flex items-center justify-between border-b border-slate-800/90 pb-4">
            <Link href="/" className="inline-flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-white">
              <span className="inline-grid h-8 w-8 place-items-center rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5">
                  <path d="M5 4v16" />
                  <path d="M5 6h10l3 3h-6" />
                  <path d="M5 14h8l2 2H5" />
                  <circle cx="17" cy="17" r="2" className="text-sky-400" stroke="currentColor" />
                </svg>
              </span>
              <span>
                Kalibre<span className="ml-1.5 rounded bg-orange-500/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-orange-300">3D</span>
              </span>
            </Link>
            <span className="font-mono text-[11px] tracking-widest text-slate-400">
              0.00 mm ── 0.20 mm LAYER
            </span>
          </div>

          {/* Regla vernier decorativa */}
          <div aria-hidden="true" className="mt-2 flex justify-between font-mono text-[9px] text-slate-600 select-none">
            <span>0</span>
            <span>|</span>
            <span>10</span>
            <span>|</span>
            <span>20</span>
            <span>|</span>
            <span>30</span>
            <span>|</span>
            <span>40</span>
            <span>|</span>
            <span>50 mm</span>
          </div>
        </div>

        {/* Propuesta central */}
        <div className="relative my-auto max-w-lg py-8">
          <div className="inline-flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-orange-300">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            Sistema operativo para makers 3D
          </div>

          <h2 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight text-white">
            Precisión de calibre en tus pedidos, bobinas y ganancia real.
          </h2>

          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            Deja de adivinar cuánto te queda después de la comisión de Mercado Libre o cuántos gramos le quedan al carrete de PETG antes de mandar a imprimir.
          </p>

          {/* Tarjeta de telemetría real */}
          <div className="mt-7 rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 font-mono text-xs">
              <span className="text-slate-400">PIEZA: EMBLEMA 13×9 (PETG · 2 COLORES)</span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                MARGEN 86%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 font-mono">
              <div className="rounded-lg bg-slate-950/70 p-2.5">
                <span className="block text-[10px] text-slate-400">FILAMENTO + PURGA</span>
                <strong className="mt-0.5 block text-sm text-white">50 g + 14 g</strong>
              </div>
              <div className="rounded-lg bg-slate-950/70 p-2.5">
                <span className="block text-[10px] text-slate-400">VENTA ML → NETO</span>
                <strong className="mt-0.5 block text-sm text-sky-300">$8.990 → $6.483</strong>
              </div>
              <div className="rounded-lg bg-slate-950/70 p-2.5">
                <span className="block text-[10px] text-slate-400">GANANCIA REAL</span>
                <strong className="mt-0.5 block text-sm text-emerald-400">+$5.588</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Especificaciones inferiores */}
        <ul className="relative space-y-3 border-t border-slate-800/90 pt-5 text-sm">
          {specs.map((item) => (
            <li key={item.code} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-orange-400">
                {item.code}
              </span>
              <div>
                <span className="font-semibold text-white">{item.title}: </span>
                <span className="text-slate-400">{item.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Columna del formulario */}
      <div className="kalibre-grid-bg relative flex min-h-screen min-w-0 max-w-full flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md min-w-0">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-ink">
              <span className="inline-grid h-7 w-7 place-items-center rounded-lg bg-slate-900 text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M5 4v16" />
                  <path d="M5 6h10l3 3h-6" />
                  <path d="M5 14h8l2 2H5" />
                </svg>
              </span>
              <span>Kalibre</span>
            </Link>
            <span className="rounded bg-primary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
              TALLER 3D
            </span>
          </div>
          <div className="reveal">{children}</div>
        </div>
      </div>
    </main>
  );
}

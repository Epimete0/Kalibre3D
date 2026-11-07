import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";

const modules = [
  {
    code: "MOD-01 · PEDIDOS",
    title: "Pedidos y entregas sin atrasos",
    description:
      "Registra ventas rápidas o encargos por fabricar desde WhatsApp, Instagram, Mercado Libre o en persona. Sigue cada pieza desde Cotizado y Confirmado hasta Imprimiendo, Listo y Entregado.",
    metrics: "Estados con versión · Alertas de atraso",
  },
  {
    code: "MOD-02 · COTIZADOR 3D",
    title: "Costo al gramo con purga multicolor",
    description:
      "Calcula el costo real sumando gramos de pieza, gramos de torre/purga multicolor (AMS/MMU), minutos de impresión eléctrica y embalaje, usando el costo promedio real de tus bobinas activas.",
    metrics: "1 clic a Pedido o Catálogo",
  },
  {
    code: "MOD-03 · BOBINAS Y STOCK",
    title: "Control de filamento y piezas terminadas",
    description:
      "Descuenta gramos de cada carrete (PLA, PETG, ASA, ABS, TPU) con movimientos inmutables. Recibe alertas en el inicio cuando una bobina baja de tu umbral en gramos o una pieza queda con stock bajo.",
    metrics: "Sin números negativos · Historial completo",
  },
  {
    code: "MOD-04 · DINERO DEL MES",
    title: "Ganancia neta real, sin mezclar platas",
    description:
      "Mira cuánto entró por cada canal y cuánto salió en filamento, repuestos, luz, envíos o devoluciones. Separa el dinero de tu taller del personal y protege los costos según el rol de tu equipo.",
    metrics: "Exclusivo Dueño / Administrador",
  },
];

const workflowSteps = [
  {
    step: "01",
    badge: "COTIZACIÓN EN VIVO",
    title: "Ingresa gramos, minutos y colores",
    detail:
      "Escribe los gramos que te da el laminador (OrcaSlicer, Bambu Studio, PrusaSlicer o Cura). Kalibre suma la purga multicolor, la luz y el embalaje, y te sugiere el precio directo y el precio para Mercado Libre.",
  },
  {
    step: "02",
    badge: "MENOS DE 30 SEGUNDOS",
    title: "Crea el pedido o registra una venta rápida",
    detail:
      "Si ya tenías la pieza impresa en stock, márcala como venta rápida y queda entregada y cobrada en un solo paso. Si es a pedido, queda en tu cola de impresión con fecha de entrega.",
  },
  {
    step: "03",
    badge: "TRAZABILIDAD TOTAL",
    title: "Descuenta filamento y cobra el neto real",
    detail:
      "Registra el consumo de tus bobinas en un toque (-25 g, -50 g, -100 g) y controla en el Panel del Mes tu ganancia limpia después de comisiones, envíos y devoluciones.",
  },
];

export default function HomePage() {
  return (
    <PublicShell showHowItWorks>
      <main className="text-ink">
        {/* HERO TÉCNICO */}
        <section className="kalibre-grid-bg relative overflow-hidden border-b border-line py-14 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-10 lg:px-16">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] [&>*]:min-w-0">
              {/* Columna izquierda: Tesis */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-surface px-3 py-1.5 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink">
                    Gestión calibrada para talleres de impresión 3D
                  </span>
                </div>

                <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-5xl lg:text-[3.35rem]">
                  Mide cada gramo.{" "}
                  <span className="text-primary">Cobra cada peso.</span>{" "}
                  Entrega a tiempo.
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                  El sistema operativo en español para makers que venden por{" "}
                  <strong className="font-semibold text-ink">WhatsApp, Instagram y Mercado Libre</strong>.
                  Conecta tus pedidos, el cotizador con purga multicolor, tus bobinas de filamento y la ganancia real del mes.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link
                    href="/registro"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <span>Crear mi taller gratis</span>
                    <span aria-hidden="true" className="font-mono text-base">→</span>
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-surface px-6 text-sm font-semibold text-ink transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Iniciar sesión
                  </Link>
                </div>

                {/* Escala de datos clave */}
                <div className="grid grid-cols-3 gap-4 border-t border-line pt-6 sm:max-w-lg [&>*]:min-w-0">
                  <div>
                    <p className="font-mono text-xl font-bold text-ink sm:text-2xl">&lt; 30 s</p>
                    <p className="mt-0.5 text-xs text-muted">Para anotar una venta desde el celular</p>
                  </div>
                  <div className="border-l border-line pl-4">
                    <p className="font-mono text-xl font-bold text-primary sm:text-2xl">100%</p>
                    <p className="mt-0.5 text-xs text-muted">Neto real de Mercado Libre calculado</p>
                  </div>
                  <div className="border-l border-line pl-4">
                    <p className="font-mono text-xl font-bold text-ink sm:text-2xl">Al gramo</p>
                    <p className="mt-0.5 text-xs text-muted">Control de bobinas y purga multicolor</p>
                  </div>
                </div>
              </div>

              {/* Columna derecha: Instrumento / Ficha de Calibración en vivo */}
              <div className="relative">
                <div className="kalibre-dark-grid overflow-hidden rounded-2xl border border-slate-800 p-5 text-slate-100 shadow-2xl sm:p-6">
                  {/* Barra superior estilo calibre digital */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" />
                      <span className="font-mono text-xs font-semibold tracking-wider text-slate-300">
                        KALIBRE · PEDIDO #42
                      </span>
                    </div>
                    <span className="rounded-md border border-sky-500/30 bg-sky-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-sky-300">
                      IMPRIMIENDO · 0.20 mm
                    </span>
                  </div>

                  {/* Pieza y parámetros técnicos */}
                  <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-900/90 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-wider text-orange-400">
                          Canal: Mercado Libre · Entrega hoy
                        </p>
                        <h2 className="mt-1 font-display text-lg font-bold text-white">
                          Emblema Toyota 13×9 cm (Bicolor)
                        </h2>
                      </div>
                      <span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs font-semibold text-slate-200">
                        PETG
                      </span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 font-mono text-xs">
                      <div>
                        <span className="block text-[10px] text-slate-400">PIEZA + PURGA</span>
                        <strong className="text-white">50 g + 14 g</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">TIEMPO MÁQUINA</span>
                        <strong className="text-white">1 h 45 min</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">COSTO TOTAL</span>
                        <strong className="text-orange-300">$1.105</strong>
                      </div>
                    </div>
                  </div>

                  {/* Desglose Mercado Libre vs Ganancia Real */}
                  <div className="mt-3.5 rounded-xl border border-slate-800/90 bg-slate-900/90 p-4 font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Precio publicado en Mercado Libre</span>
                      <span className="font-semibold text-white">$8.990</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-slate-400">
                      <span>− Comisión ML (19%)</span>
                      <span className="text-rose-400">−$1.708</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-slate-400">
                      <span>− Envío a cargo del taller</span>
                      <span className="text-rose-400">−$799</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2.5 text-sm">
                      <span className="font-sans font-semibold text-slate-200">Ingreso neto que recibes</span>
                      <strong className="text-sky-300">$6.483</strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2 text-sm">
                      <span className="font-sans font-semibold text-emerald-300">Ganancia real (Neto − Costo)</span>
                      <strong className="text-emerald-400">+$5.378</strong>
                    </div>
                  </div>

                  {/* Estado de bobina activa */}
                  <div className="mt-3.5 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-semibold text-amber-300">
                        ALERTA DE BOBINA · PETG NEGRO
                      </p>
                      <p className="truncate text-xs text-slate-300">
                        Quedan 120 g de 1.000 g (bajo umbral de 150 g)
                      </p>
                    </div>
                    <span className="shrink-0 rounded bg-amber-400/20 px-2 py-1 font-mono text-xs font-bold text-amber-300">
                      12%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MÓDULOS PRINCIPALES (#pilares) */}
        <section id="pilares" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-10 lg:px-16">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                Diseñado para la realidad del taller 3D
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Todo lo que una planilla de Excel no te avisa antes de imprimir.
              </h2>
              <p className="mt-3 text-base text-muted">
                Sin módulos de relleno: cuatro herramientas conectadas para que sepas qué debes entregar, cuánto te cuesta fabricarlo y cuánto ganaste realmente este mes.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {modules.map((mod) => (
                <article
                  key={mod.code}
                  className="flex flex-col justify-between rounded-2xl border border-line bg-surface p-6 shadow-2xs transition-colors hover:border-line-strong"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-primary-soft px-2.5 py-1 font-mono text-xs font-bold text-primary">
                        {mod.code}
                      </span>
                      <span className="font-mono text-xs text-faint">{mod.metrics}</span>
                    </div>
                    <h3 className="mt-4 font-display text-xl font-bold text-ink">{mod.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{mod.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARATIVA MERCADO LIBRE Y COSTEO (#cotizador-real) */}
        <section id="cotizador-real" className="border-y border-line bg-surface py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-10 lg:px-16">
            <div className="grid items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-accent">
                  Cotizador y canales de venta
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  Vender a $8.990 en Mercado Libre no es ganar $8.990.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                  Cuando marcas la casilla <strong className="font-semibold text-ink">«Venta por Mercado Libre»</strong> en Kalibre, el pedido cambia automáticamente a tus precios de ML, descuenta el porcentaje de comisión y el envío a tu cargo, y registra en Dinero exactamente el neto que entra a tu cuenta.
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-ink">
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    <span>Calcula cuánto cobrar en ML para empatar tu ganancia de venta directa.</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                    <span>Registra devoluciones en un paso descontando el reembolso del mes.</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-ok" />
                    <span>Soporta monedas de toda la región (CLP, ARS, MXN, COP, PEN, UYU, USD).</span>
                  </li>
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
                <div className="rounded-2xl border border-line bg-canvas p-5">
                  <span className="rounded bg-ok-soft px-2.5 py-1 font-mono text-xs font-bold text-ok">
                    VENTA DIRECTA (WHATSAPP / IG)
                  </span>
                  <p className="mt-4 font-display text-3xl font-bold text-ink">$6.500</p>
                  <p className="mt-1 text-xs text-muted">Sin comisión de plataforma</p>
                  <dl className="mt-5 space-y-2 border-t border-line pt-4 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted">Filamento + Purga (64 g)</dt>
                      <dd className="text-ink">$960</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Luz (1h 45m) + Embalaje</dt>
                      <dd className="text-ink">$145</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-2 text-sm font-bold">
                      <dt className="font-sans text-ink">Te quedan limpios</dt>
                      <dd className="text-ok">+$5.395</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-2xl border-2 border-primary/40 bg-canvas p-5">
                  <span className="rounded bg-primary-soft px-2.5 py-1 font-mono text-xs font-bold text-primary">
                    PRECIO SUGERIDO MERCADO LIBRE
                  </span>
                  <p className="mt-4 font-display text-3xl font-bold text-ink">$8.990</p>
                  <p className="mt-1 text-xs text-muted">Incluye 19% comisión ($1.708) + envío ($799)</p>
                  <dl className="mt-5 space-y-2 border-t border-line pt-4 font-mono text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted">Neto liberado por ML</dt>
                      <dd className="font-semibold text-accent">$6.483</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Costo de fabricación</dt>
                      <dd className="text-ink">−$1.105</dd>
                    </div>
                    <div className="flex justify-between border-t border-line pt-2 text-sm font-bold">
                      <dt className="font-sans text-ink">Te quedan limpios</dt>
                      <dd className="text-ok">+$5.378</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FLUJO DE TRABAJO (#flujo) */}
        <section id="flujo" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-10 lg:px-16">
            <div className="max-w-2xl">
              <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
                Flujo operativo
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                Tres pasos desde que te piden precio hasta que entregas la pieza.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {workflowSteps.map((item) => (
                <div key={item.step} className="rounded-2xl border border-line bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-3xl font-bold text-primary">{item.step}</span>
                    <span className="rounded bg-raised px-2.5 py-1 font-mono text-[11px] font-semibold text-muted">
                      {item.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="pb-16 sm:pb-24">
          <div className="mx-auto max-w-6xl px-5 sm:px-10 lg:px-16">
            <div className="kalibre-dark-grid rounded-3xl border border-slate-800 px-6 py-12 text-center text-white shadow-xl sm:px-12 sm:py-16">
              <span className="inline-block rounded-md border border-orange-500/30 bg-orange-500/15 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-orange-300">
                Listo para usar en celular y computador
              </span>
              <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Pon en orden los pedidos, las bobinas y los números de tu taller 3D.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
                Crea tu taller en un minuto, configura el costo de tu electricidad y comisión de Mercado Libre, y registra tu primer pedido hoy mismo.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3.5">
                <Link
                  href="/registro"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-7 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
                >
                  Crear mi taller ahora
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 px-7 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-800"
                >
                  Ya tengo una cuenta
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

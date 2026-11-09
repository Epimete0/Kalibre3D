import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { PublicQuoteCalculator } from "./PublicQuoteCalculator";

export const metadata: Metadata = {
  title: "Cotizador de impresión 3D gratis | Kalibre",
  description:
    "Calcula gratis y sin registrarte cuánto te cuesta imprimir una pieza 3D y cuánto cobrar: filamento, luz por kWh, purga multicolor, desgaste, IVA y comisión de Mercado Libre.",
  alternates: { canonical: "/herramientas/cotizador" },
};

export default function PublicQuotePage() {
  return (
    <PublicShell showHowItWorks>
      <main className="mx-auto max-w-6xl px-4 pb-28 pt-10 text-ink sm:px-10 sm:pt-14 lg:px-16 lg:pb-14">
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-primary">Herramientas · Gratis</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Cotizador de impresión 3D</h1>
        <p className="mt-2 max-w-2xl text-base text-muted">
          Calcula cuánto te cuesta imprimir una pieza y cuánto cobrar por ella. No necesitas cuenta: escribe tus datos y el
          resultado se actualiza al tiro. Nada de lo que escribes se guarda ni sale de tu navegador.
        </p>
        <div className="mt-8">
          <PublicQuoteCalculator />
        </div>
      </main>
    </PublicShell>
  );
}

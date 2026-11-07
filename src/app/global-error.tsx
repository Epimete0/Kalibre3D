"use client";

import "./globals.css";

/** Último recurso: falla el diseño raíz de la aplicación. Reemplaza toda la página, así que trae su propio `html` y `body`. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es" data-theme="light">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl text-ink">Algo salió mal</h1>
          <p className="mt-4 text-muted">No fue posible cargar Kalibre. Intenta nuevamente en unos momentos.</p>
          <button type="button" onClick={reset} className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-white">Reintentar</button>
        </main>
      </body>
    </html>
  );
}

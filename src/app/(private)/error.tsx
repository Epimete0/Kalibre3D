"use client";

export default function PrivateError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 text-center"><h1 className="text-3xl text-ink">No pudimos cargar esta sección</h1><p className="mt-3 text-sm text-muted">Intenta nuevamente. Si el problema continúa, vuelve más tarde.</p><button type="button" onClick={() => reset()} className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">Reintentar</button></main>;
}

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center text-ink">
      <div className="max-w-md space-y-3">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Taller 3D
        </h1>
        <p className="text-base text-muted sm:text-lg">
          Gestión de pedidos, dinero, costos y filamento para talleres de impresión 3D. En construcción.
        </p>
      </div>
    </main>
  );
}

import Link from "next/link";

const TABS = [
  { key: "resumen", href: "/money", label: "Resumen" },
  { key: "compras", href: "/money/compras", label: "Compras" },
  { key: "rentabilidad", href: "/money/rentabilidad", label: "Rentabilidad" },
] as const;

/** Pestañas de Dinero: lo que entró y salió, en qué gastaste y qué pieza te deja más ganancia. */
export function MoneyTabs({ active, month }: { active: (typeof TABS)[number]["key"]; month?: string }) {
  return (
    <nav aria-label="Secciones de Dinero" className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={month ? `${tab.href}?month=${month}` : tab.href}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors ${
              selected ? "bg-primary text-white shadow-sm" : "text-ink hover:bg-canvas"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

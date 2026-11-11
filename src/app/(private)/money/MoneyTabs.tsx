import Link from "next/link";

const TABS = [
  { key: "caja", href: "/money", label: "Caja del mes" },
  { key: "margen", href: "/money/rentabilidad", label: "Margen por pieza" },
] as const;

export type MoneyTabKey = (typeof TABS)[number]["key"];

/** Pestañas de Dinero: Caja (entradas, salidas y saldo en mano) y Margen por pieza (retorno por modelo). */
export function MoneyTabs({
  active,
  month,
}: {
  active: MoneyTabKey;
  month?: string;
}) {
  return (
    <nav
      aria-label="Secciones de Dinero"
      className="grid grid-cols-2 max-w-md gap-1 rounded-xl border border-line bg-surface p-1"
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={month ? `${tab.href}?month=${month}` : tab.href}
            aria-current={selected ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors ${
              selected
                ? "bg-primary text-white shadow-sm"
                : "text-ink hover:bg-canvas"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

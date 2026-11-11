import Link from "next/link";
import { segmentedItemClass, segmentedTrackClass } from "@/components/ui";

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
      className={`grid grid-cols-2 max-w-md ${segmentedTrackClass}`}
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={month ? `${tab.href}?month=${month}` : tab.href}
            aria-current={selected ? "page" : undefined}
            className={`min-h-10 ${segmentedItemClass(selected)}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

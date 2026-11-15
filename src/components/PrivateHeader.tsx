"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { KalibreMark } from "@/components/KalibreMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AccountSummary } from "@/lib/auth";

export type PrivateHeaderProps = {
  account: AccountSummary | null;
};

function resolveSectionLabel(pathname: string): string {
  if (pathname === "/dashboard") return "Inicio";
  if (pathname === "/orders/new") return "Nueva venta";
  if (pathname.startsWith("/orders")) return "Pedidos y ventas";
  if (pathname.startsWith("/quote")) return "Cotizar pieza";
  if (pathname.startsWith("/products")) return "Catálogo de piezas";
  if (pathname.startsWith("/spools")) return "Bobinas de filamento";
  if (pathname.startsWith("/clients")) return "Clientes";
  if (pathname.startsWith("/money")) return "Dinero";
  if (pathname.startsWith("/settings")) return "Mis costos";
  if (pathname.startsWith("/profile")) return "Mi cuenta";
  if (pathname.startsWith("/team")) return "Equipo";
  return "Taller";
}

export function PrivateHeader({ account }: PrivateHeaderProps) {
  const pathname = usePathname();
  const sectionLabel = resolveSectionLabel(pathname);

  return (
    <header className="dashboard-topbar sticky top-0 z-20 border-b border-line/60 bg-canvas/90 px-4 py-2 backdrop-blur-xl sm:px-6 lg:static lg:border-b-0 lg:bg-transparent lg:px-[clamp(16px,2vw,30px)] lg:pt-2.5 lg:pb-1 lg:backdrop-blur-none">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/dashboard" className="inline-flex items-center gap-2 lg:hidden">
            <KalibreMark size="sm" />
            <span className="font-display text-base font-bold tracking-[-0.02em] text-ink">Kalibre</span>
          </Link>
          <span className="text-line-strong lg:hidden" aria-hidden="true">/</span>
          <span className="truncate text-xs sm:text-sm font-semibold text-muted lg:text-xs lg:uppercase lg:tracking-wider">
            {sectionLabel}
          </span>
        </div>

        <div className="ml-auto flex items-center justify-end gap-2.5">
          <ThemeToggle className="dashboard-theme-toggle" />
          {account ? (
            <div className="flex items-center gap-2">
              <AccountMenu account={account} />
              <span className="hidden min-w-0 max-w-40 xl:block">
                <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
                  {account.displayName || "Mi cuenta"}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-muted">
                  {account.centerName}
                </span>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

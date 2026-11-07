"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AccountSummary } from "@/lib/auth";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const icons = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  calendar: <><path d="M6 4h12v16H6zM9 2v4M15 2v4M6 9h12" /><path d="M9 13h6M9 16h4" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M17 14a4 4 0 0 1 4 4v1" /></>,
  orders: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></>,
  cube: <><path d="m3 7.5 9-4.5 9 4.5-9 4.5-9-4.5Z" /><path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9" /></>,
  spool: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4v5M12 15v5M4 12h5M15 12h5" /></>,
  calculator: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></>,
  chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  workshop: <><circle cx="12" cy="8" r="4" /><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" /></>,
};

function NavigationIcon({ children }: { children: React.ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">{children}</svg>;
}

function FeatureLink({ item, helper, active }: { item: NavItem; helper?: string; active: boolean }) {
  return <Link href={item.href} className={`flex items-center gap-3 rounded-[13px] px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? "bg-primary-soft text-primary" : "text-ink hover:bg-accent-soft"}`}><span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] ${active ? "bg-surface shadow-[0_1px_2px_rgba(90,40,55,.04),0_8px_24px_-12px_rgba(90,40,55,.10)]" : item.href === "/inventory" ? "bg-warn-soft text-warn" : "bg-primary-soft text-primary"}`}><NavigationIcon>{item.icon}</NavigationIcon></span><span className="min-w-0"><span className="block text-[13.5px] font-semibold leading-[1.25]">{item.label}</span>{helper ? <span className="mt-0.5 block truncate text-[11px] font-normal text-muted">{helper}</span> : null}</span></Link>;
}

function PlainLink({ item, active, compact = false }: { item: NavItem; active: boolean; compact?: boolean }) {
  return <Link href={item.href} className={`flex ${compact ? "min-h-9" : "min-h-10"} items-center gap-3 rounded-[13px] px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? "bg-primary-soft text-primary" : "text-faint hover:bg-accent-soft hover:text-ink"}`}><NavigationIcon>{item.icon}</NavigationIcon>{item.label}</Link>;
}

export function Sidebar({ account }: { account: AccountSummary | null }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const isManager = account?.role === "OWNER" || account?.role === "ADMIN";
  const canOperate =
    account?.role === "OWNER" ||
    account?.role === "ADMIN" ||
    account?.role === "PROFESSIONAL";

  return (
    <aside className="dashboard-sidebar sticky top-0 hidden h-screen w-[236px] shrink-0 flex-col gap-1 overflow-hidden px-[18px] pb-[14px] pt-[clamp(14px,2.4vh,24px)] lg:flex">
      <div className="mb-[clamp(12px,2.6vh,24px)] px-0.5">
        <Link href="/dashboard" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
          <span className="font-display text-[27px] leading-none tracking-[-0.04em] text-ink">
            Taller 3D<span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
          </span>
          <span className="mt-1 block truncate text-xs text-muted">{account?.centerName || "Tu taller"}</span>
        </Link>
      </div>
      <nav aria-label="Navegación principal" className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        <FeatureLink item={{ href: "/dashboard", label: "Inicio", icon: icons.home }} active={isActive("/dashboard")} />
        <div className="pt-3 space-y-1">
          <PlainLink item={{ href: "/orders", label: "Pedidos", icon: icons.orders }} active={isActive("/orders")} />
          {canOperate ? (
            <PlainLink item={{ href: "/quote", label: "Cotizador", icon: icons.calculator }} active={isActive("/quote")} />
          ) : null}
          <PlainLink item={{ href: "/products", label: "Catálogo de piezas", icon: icons.cube }} active={isActive("/products")} />
          <PlainLink item={{ href: "/spools", label: "Bobinas", icon: icons.spool }} active={isActive("/spools")} />
          <PlainLink item={{ href: "/clients", label: "Clientes", icon: icons.people }} active={isActive("/clients")} />
          {isManager ? (
            <PlainLink item={{ href: "/money", label: "Dinero", icon: icons.chart }} active={isActive("/money")} />
          ) : null}
          {isManager ? (
            <PlainLink item={{ href: "/settings", label: "Ajustes", icon: icons.settings }} active={isActive("/settings")} />
          ) : null}
          <PlainLink item={{ href: "/profile", label: "Mi taller", icon: icons.workshop }} active={isActive("/profile")} />
        </div>
      </nav>
    </aside>
  );
}

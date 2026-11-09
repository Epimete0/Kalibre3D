"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AccountSummary } from "@/lib/auth";

type NavEntry = { href: string; label: string; description?: string; icon: React.ReactNode };

const icons = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
  orders: (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="m9 14 2 2 4-4" />
    </>
  ),
  quote: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
    </>
  ),
  money: (
    <>
      <path d="M4 19V5M4 19h16" />
      <path d="m7 15 4-4 3 2 5-6" />
    </>
  ),
  clients: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M17 14a4 4 0 0 1 4 4v1" />
    </>
  ),
  catalog: (
    <>
      <path d="m3 7.5 9-4.5 9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9" />
    </>
  ),
  spool: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v5M12 15v5M4 12h5M15 12h5" />
    </>
  ),
  costs: (
    <>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  account: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    </>
  ),
};

function Icon({ children, className = "h-[18px] w-[18px]" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

/**
 * Barra inferior del celular. Lo que más se hace va a un toque: registrar una venta (botón central) y cotizar.
 * Lo demás queda en "Más", con una línea que explica para qué sirve cada sección.
 */
export function MobileNav({ account }: { account?: AccountSummary | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isManager = account?.role === "OWNER" || account?.role === "ADMIN";
  const canOperate = isManager || account?.role === "PROFESSIONAL";

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);

  const leftItems: NavEntry[] = [
    { href: "/dashboard", label: "Inicio", icon: icons.home },
    { href: "/orders", label: "Pedidos", icon: icons.orders },
  ];
  const rightItems: NavEntry[] = canOperate
    ? [{ href: "/quote", label: "Cotizar", icon: icons.quote }]
    : [{ href: "/clients", label: "Clientes", icon: icons.clients }];

  const moreItems: NavEntry[] = [
    ...(isManager
      ? [{ href: "/money", label: "Dinero", description: "Cuánto entró, cuánto salió y tu ganancia del mes", icon: icons.money }]
      : []),
    ...(canOperate ? [{ href: "/clients", label: "Clientes", description: "Quiénes te compran y cuánto te deben", icon: icons.clients }] : []),
    { href: "/products", label: "Catálogo de piezas", description: "Tus piezas habituales para vender en un toque", icon: icons.catalog },
    { href: "/spools", label: "Bobinas", description: "Cuánto filamento te queda y cuánto te cuesta", icon: icons.spool },
    ...(isManager
      ? [{ href: "/settings", label: "Mis costos", description: "Luz, comisiones, IVA y margen mínimo", icon: icons.costs }]
      : []),
    { href: "/profile", label: "Mi cuenta", description: "Tu correo, contraseña y nombre del taller", icon: icons.account },
  ];

  // Escape cierra el menú "Más".
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moreOpen]);

  const isMoreActive = moreItems.some((item) => isActive(item.href));
  const saleActive = pathname.startsWith("/orders/new");

  const tab = (item: NavEntry) => {
    const active = isActive(item.href) && !(item.href === "/orders" && saleActive);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMoreOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 touch-manipulation ${
          active ? "bg-primary-soft text-primary-ink" : "text-muted hover:bg-primary-soft/70 hover:text-ink"
        }`}
      >
        <Icon>{item.icon}</Icon>
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-label="Más secciones"
            className="fixed inset-x-3 bottom-20 z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-2xl space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1 border-b border-line/60">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Más secciones</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="min-h-9 rounded-lg px-2 text-xs font-semibold text-muted hover:text-ink"
              >
                Cerrar ✕
              </button>
            </div>
            {moreItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors touch-manipulation ${
                    active ? "bg-primary-soft text-primary-ink" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <Icon>{item.icon}</Icon>
                  </span>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">{item.label}</span>
                    <span className="block text-xs text-muted">{item.description}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-end border-t border-line bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden"
      >
        {leftItems.map(tab)}

        {canOperate ? (
          <Link
            href="/orders/new"
            onClick={() => setMoreOpen(false)}
            aria-current={saleActive ? "page" : undefined}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-center text-[11.5px] font-bold text-primary touch-manipulation focus-visible:outline-none"
          >
            <span className="-mt-5 grid h-12 w-12 place-items-center rounded-full bg-primary text-white shadow-lg ring-4 ring-surface transition-transform active:scale-95">
              <Icon className="h-6 w-6">
                <path d="M12 5v14M5 12h14" />
              </Icon>
            </span>
            <span>Vender</span>
          </Link>
        ) : (
          tab({ href: "/products", label: "Catálogo", icon: icons.catalog })
        )}

        {rightItems.map(tab)}

        <button
          type="button"
          onClick={() => setMoreOpen((prev) => !prev)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 touch-manipulation ${
            moreOpen || isMoreActive ? "bg-primary-soft text-primary-ink" : "text-muted hover:bg-primary-soft/70 hover:text-ink"
          }`}
        >
          <Icon className="h-[18px] w-[18px]">
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </Icon>
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AccountSummary } from "@/lib/auth";

export function MobileNav({ account }: { account?: AccountSummary | null }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isManager = account?.role === "OWNER" || account?.role === "ADMIN";
  const canOperate =
    account?.role === "OWNER" ||
    account?.role === "ADMIN" ||
    account?.role === "PROFESSIONAL";

  const mainItems = [
    {
      href: "/dashboard",
      label: "Inicio",
      icon: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5" />,
    },
    {
      href: "/orders",
      label: "Pedidos",
      icon: (
        <>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </>
      ),
    },
    {
      href: "/clients",
      label: "Clientes",
      icon: (
        <>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0-1-5.8M17 14a4 4 0 0 1 4 4v1" />
        </>
      ),
    },
    ...(isManager
      ? [
          {
            href: "/money",
            label: "Dinero",
            icon: (
              <>
                <path d="M4 19V5M4 19h16" />
                <path d="m7 15 4-4 3 2 5-6" />
              </>
            ),
          },
        ]
      : []),
  ];

  const moreItems = [
    ...(canOperate
      ? [
          {
            href: "/quote",
            label: "Cotizador",
            description: "Calcula costos, margen y precio en Mercado Libre",
            icon: (
              <>
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />
              </>
            ),
          },
        ]
      : []),
    {
      href: "/products",
      label: "Catálogo de piezas",
      description: "Gramos, tiempos, stock y precios de venta",
      icon: (
        <>
          <path d="m3 7.5 9-4.5 9 4.5-9 4.5-9-4.5Z" />
          <path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9" />
        </>
      ),
    },
    {
      href: "/spools",
      label: "Bobinas",
      description: "Filamento restante y costo por gramo",
      icon: (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v5M12 15v5M4 12h5M15 12h5" />
        </>
      ),
    },
    ...(isManager
      ? [
          {
            href: "/settings",
            label: "Ajustes del taller",
            description: "Moneda, zona horaria y parámetros de ML",
            icon: (
              <>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.3l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
              </>
            ),
          },
        ]
      : []),
    {
      href: "/profile",
      label: "Mi taller",
      description: "Tu cuenta, contraseña y datos del taller",
      icon: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
        </>
      ),
    },
  ];

  const isMoreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  const totalCols = mainItems.length + 1;

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-line bg-surface p-3 shadow-2xl space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 py-1 border-b border-line/60">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                Más opciones
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded-lg p-1 text-xs font-semibold text-muted hover:text-ink"
              >
                Cerrar ✕
              </button>
            </div>
            {moreItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors touch-manipulation ${
                    active
                      ? "bg-primary-soft text-primary-ink"
                      : "text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-[18px] w-[18px]"
                    >
                      {item.icon}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold leading-tight">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {item.description}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <nav
        aria-label="Navegación principal"
        className={`fixed inset-x-0 bottom-0 z-20 grid ${
          totalCols === 5 ? "grid-cols-5" : "grid-cols-4"
        } border-t border-line bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden`}
      >
        {mainItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 touch-manipulation ${
                active
                  ? "bg-primary-soft text-primary-ink"
                  : "text-muted hover:bg-primary-soft/70 hover:text-ink"
              }`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[18px] w-[18px]"
              >
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen((prev) => !prev)}
          aria-expanded={moreOpen}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11.5px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 touch-manipulation ${
            moreOpen || isMoreActive
              ? "bg-primary-soft text-primary-ink"
              : "text-muted hover:bg-primary-soft/70 hover:text-ink"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[18px] w-[18px]"
          >
            <circle cx="5" cy="12" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
          </svg>
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}

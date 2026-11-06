"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { browserStorage, clearAllDrafts } from "@/lib/form-draft";
import type { AccountSummary } from "@/lib/auth";

// Menú de cuenta compartido por el Sidebar (desktop) y el PrivateHeader (mobile).
// Centraliza Ajustes de cuenta, Cambiar taller y Cerrar sesión para que la sesión
// se pueda cerrar en cualquier tamaño de pantalla.
export function AccountMenu({ account }: { account: AccountSummary }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const initial = (account.displayName || "Mi cuenta").trim().charAt(0).toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir menú de cuenta"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-canvas text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary-soft"
      >
        {initial}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-line bg-surface p-2 shadow-[0_14px_32px_rgba(35,31,26,0.14)]"
        >
          <div className="border-b border-line px-3 pb-2 pt-1">
            <p className="truncate text-sm font-medium text-ink">{account.displayName || "Mi cuenta"}</p>
            <p className="truncate text-xs text-muted">{account.centerName}</p>
          </div>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="mt-2 block rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas">
            Ajustes de cuenta
          </Link>
          <Link role="menuitem" href="/profile#mi-taller" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas">
            Mi taller
          </Link>
          <Link role="menuitem" href="/team" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-canvas">
            Cambiar taller
          </Link>
          <form action={logoutAction} onSubmit={() => clearAllDrafts(browserStorage())} className="mt-1 border-t border-line pt-1">
            <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

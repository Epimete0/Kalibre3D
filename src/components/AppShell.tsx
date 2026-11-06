"use client";

import { Sidebar } from "@/components/Sidebar";
import { MobileNav } from "@/components/MobileNav";
import { PrivateHeader } from "@/components/PrivateHeader";
import type { AccountSummary } from "@/lib/auth";
import { DraftScopeProvider } from "@/components/FormDraft";
import { draftScope } from "@/lib/form-draft";
import type { ReactNode } from "react";

export function AppShell({ children, account }: { children: ReactNode; account: AccountSummary | null }) {
  return <DraftScopeProvider scope={account ? draftScope(account.userId, account.centerId) : null}><div className="saas3d-private-shell flex min-h-screen bg-canvas"><a href="#main-content" className="fixed left-4 top-3 z-50 -translate-y-20 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0">Saltar al contenido</a><Sidebar account={account} /><main id="main-content" className="saas3d-private-main min-w-0 flex-1 pb-28 lg:pb-0"><PrivateHeader account={account} /><div className="saas3d-private-content w-full px-4 pb-4 pt-4 sm:px-6 lg:px-[clamp(16px,2vw,30px)] lg:pb-[clamp(10px,1.8vh,18px)] lg:pt-[clamp(10px,1.8vh,18px)]">{children}</div></main><MobileNav /></div></DraftScopeProvider>;
}

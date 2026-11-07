"use client";

import { AccountMenu } from "@/components/AccountMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { AccountSummary } from "@/lib/auth";

export type PrivateHeaderProps = {
  account: AccountSummary | null;
};

export function PrivateHeader({ account }: PrivateHeaderProps) {
  return <header className="dashboard-topbar sticky top-0 z-20 bg-canvas/88 px-4 pt-3 backdrop-blur-xl sm:px-6 lg:static lg:bg-transparent lg:px-[clamp(16px,2vw,30px)] lg:pt-[clamp(10px,1.8vh,18px)] lg:backdrop-blur-none"><div className="flex w-full items-center gap-3.5"><p className="font-display text-lg text-ink lg:hidden">Kalibre</p><div className="ml-auto flex items-center justify-end gap-3"><ThemeToggle className="dashboard-theme-toggle" />{account ? <div className="flex items-center gap-2"><AccountMenu account={account} /><span className="hidden min-w-0 max-w-36 xl:block"><span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">{account.displayName || "Mi cuenta"}</span><span className="mt-0.5 block truncate text-[10.5px] text-muted">{account.centerName}</span></span></div> : null}</div></div></header>;
}

"use client";

export function AsyncActionButton({ children, pending, pendingLabel = "Procesando…" }: { children: React.ReactNode; pending: boolean; pendingLabel?: string }) {
  return <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}{pending ? pendingLabel : children}</button>;
}

import Link from "next/link";

// Shared input styling used across forms with crisp border, subtle shadow and focus ring.
export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-faint shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 " +
  "focus:border-primary focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-50";

// Segmented track & item classes for cohesive controls (replacing loose piles of buttons)
export const segmentedTrackClass =
  "inline-flex max-w-full items-center gap-1 rounded-2xl border border-line bg-raised/70 p-1 shadow-inner";

export const segmentedItemClass = (active: boolean) =>
  `flex items-center justify-center rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-all duration-150 touch-manipulation ${
    active
      ? "bg-surface text-ink font-bold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:bg-raised dark:border-line border border-line/60"
      : "text-muted hover:text-ink hover:bg-canvas/50"
  }`;

export const filterChipClass = (active: boolean) =>
  `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-150 touch-manipulation ${
    active
      ? "border-primary/35 bg-primary-soft text-primary-ink font-bold shadow-xs ring-1 ring-primary/20"
      : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink hover:bg-raised/50"
  }`;

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8 sm:items-end sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl tracking-[-0.03em] text-ink font-bold">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div
      {...rest}
      className={`rounded-[var(--radius-lg)] border border-line/80 bg-surface shadow-[0_1px_3px_rgba(15,23,42,0.04),0_6px_20px_-4px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] ${className}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`block ${className}`}>
      <span className="mb-1.5 flex items-center gap-1 text-sm font-medium text-ink">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

type LinkButtonProps = {
  href: string;
  variant?: "primary" | "ghost";
  children: React.ReactNode;
};

export function LinkButton({ href, variant = "primary", children }: LinkButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-gradient-to-b from-primary to-primary-hover text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_6px_16px_rgba(217,83,30,0.28)] ring-1 ring-inset ring-white/20 hover:brightness-105"
      : "border border-line bg-surface text-ink hover:bg-raised shadow-xs";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 py-2 text-center text-sm font-semibold transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas touch-manipulation ${styles}`}
    >
      {children}
    </Link>
  );
}

export function EditIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m13.5 3.5 3 3M4 16l.7-3.3L13.5 4.5l3 3-8.8 8.2L4 16Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function EditLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={`Editar ${label}`} title={`Editar ${label}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-line bg-raised text-primary transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 touch-manipulation"><EditIcon /></Link>;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "danger" | "accent";
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-raised text-muted border-line/80",
    ok: "bg-ok-soft text-ok border-ok/25 font-semibold",
    warn: "bg-warn-soft text-warn border-warn/25 font-semibold",
    danger: "bg-danger-soft text-danger border-danger/25 font-semibold",
    accent: "bg-accent-soft text-accent border-accent/35 font-semibold",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] whitespace-nowrap shadow-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface/50 px-6 py-16 text-center">
      <h3 className="text-lg text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

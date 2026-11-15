import Link from "next/link";

// Shared input styling used across forms with crisp border, subtle shadow and focus ring.
export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink " +
  "placeholder:text-faint shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow,background-color] duration-150 ease-[var(--ease-out)] " +
  "focus:border-primary focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-50";

// Segmented track & item classes for cohesive controls (replacing loose piles of buttons)
export const segmentedTrackClass =
  "inline-flex max-w-full items-center gap-1 rounded-2xl border border-line bg-raised/70 p-1";

export const segmentedItemClass = (active: boolean) =>
  `flex items-center justify-center rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] touch-manipulation ${
    active
      ? "bg-surface text-ink font-bold shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:bg-raised dark:border-line border border-line/60"
      : "text-muted hover:text-ink hover:bg-canvas/50"
  }`;

export const filterChipClass = (active: boolean) =>
  `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] touch-manipulation ${
    active
      ? "border-ink bg-ink text-surface font-bold shadow-xs"
      : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink hover:bg-raised/60"
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
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5 sm:items-end sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[26px] tracking-[-0.03em] text-ink font-bold">{title}</h1>
        {description ? (
          <p className="mt-0.5 max-w-2xl text-sm text-muted">{description}</p>
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
      className={`rounded-[var(--radius-lg)] border border-line bg-surface shadow-[0_1px_2px_rgba(28,29,33,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.28)] ${className}`}
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
      ? "bg-primary text-white shadow-[0_1px_2px_rgba(28,29,33,0.14)] hover:bg-primary-hover"
      : "border border-line-strong bg-surface text-ink hover:bg-raised shadow-xs";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-center text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-[var(--ease-out)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas touch-manipulation ${styles}`}
    >
      {children}
    </Link>
  );
}

export function EditIcon() {
  return <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m13.5 3.5 3 3M4 16l.7-3.3L13.5 4.5l3 3-8.8 8.2L4 16Z" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function EditLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} aria-label={`Editar ${label}`} title={`Editar ${label}`} className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-line bg-raised text-ink transition-colors hover:bg-ink hover:text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 touch-manipulation"><EditIcon /></Link>;
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
    accent: "bg-raised text-ink border-line-strong font-semibold",
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
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl border border-line bg-raised/80 text-muted">
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 7.5 9-4.5 9 4.5-9 4.5-9-4.5Z" />
          <path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9" />
        </svg>
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-ink">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-xs sm:text-sm text-muted leading-relaxed">{description}</p>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

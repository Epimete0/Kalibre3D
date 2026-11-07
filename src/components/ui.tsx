import Link from "next/link";

// Shared input styling used across forms.
export const inputClass =
  "w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink " +
  "placeholder:text-faint shadow-sm transition-colors " +
  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
        <h1 className="text-2xl sm:text-3xl tracking-[-0.03em] text-ink">{title}</h1>
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
      className={`rounded-[var(--radius-lg)] border border-line/90 bg-surface shadow-[0_8px_22px_rgba(15,23,42,0.035)] ${className}`}
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
      ? "bg-primary text-white hover:bg-primary-hover shadow-[0_10px_22px_rgba(217,83,30,0.2)]"
      : "border border-line bg-raised text-ink hover:bg-canvas";
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-center text-sm font-semibold transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas touch-manipulation ${styles}`}
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
    neutral: "bg-canvas text-muted border-line",
    ok: "bg-ok-soft text-ok border-ok/20",
    warn: "bg-warn-soft text-warn border-warn/20",
    danger: "bg-danger-soft text-danger border-danger/20",
    accent: "bg-accent-soft text-accent border-accent/30",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}
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

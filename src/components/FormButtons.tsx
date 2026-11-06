"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children = "Guardar",
  pendingText = "Guardando…",
  formAction,
  name,
  value,
  pendingKey,
  pendingIntent,
  variant = "primary",
  onClick,
  disabled = false,
}: {
  children?: React.ReactNode;
  pendingText?: string;
  formAction?: (formData: FormData) => void;
  name?: string;
  value?: string;
  pendingKey?: string;
  pendingIntent?: string;
  variant?: "primary" | "secondary";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const showPending = pending && (pendingKey === undefined || pendingKey === pendingIntent);
  return (
    <button
      type="submit"
      formAction={formAction}
      name={name}
      value={value}
      onClick={onClick}
      disabled={pending || disabled}
      className={variant === "primary" ? "inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors touch-manipulation hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60" : "inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-raised px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors touch-manipulation hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"}
    >
      {showPending ? (
        <span className={`h-3.5 w-3.5 animate-spin rounded-full border-2 ${variant === "primary" ? "border-white/40 border-t-white" : "border-line border-t-primary"}`} />
      ) : null}
      {showPending ? pendingText : children}
    </button>
  );
}

export function DeleteButton({
  action,
  confirmMessage = "¿Eliminar este registro? Esta acción no se puede deshacer.",
  label = "Eliminar",
}: {
  action: () => void;
  confirmMessage?: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-md px-2.5 py-1.5 text-xs font-medium text-danger transition-colors hover:bg-danger-soft"
      >
        {label}
      </button>
    </form>
  );
}

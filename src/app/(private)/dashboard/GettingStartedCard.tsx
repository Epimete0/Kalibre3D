import Link from "next/link";
import { Card } from "@/components/ui";
import type { GettingStarted } from "@/lib/getting-started";

/** Lista de primeros pasos para un taller nuevo. Desaparece sola cuando los tres pasos están hechos. */
export function GettingStartedCard({ gettingStarted }: { gettingStarted: GettingStarted }) {
  const { steps, completed } = gettingStarted;
  const total = steps.length;
  const nextKey = steps.find((step) => !step.done)?.key;

  return (
    <Card className="p-4 sm:p-5" role="region" aria-labelledby="getting-started-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="getting-started-title" className="font-display text-lg font-bold text-ink">
          Primeros pasos
        </h2>
        <span className="font-mono text-xs font-semibold text-muted">
          {completed} de {total}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">Tres pasos para tener tu taller en orden desde hoy.</p>

      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
        aria-label={`${completed} de ${total} pasos hechos`}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(completed / total) * 100}%` }} />
      </div>

      <ol className="mt-4 space-y-2.5">
        {steps.map((step, index) => {
          const isNext = step.key === nextKey;
          return (
            <li
              key={step.key}
              className={`flex items-start gap-3 rounded-xl border p-3 ${
                isNext ? "border-primary/40 bg-primary-soft/40" : "border-line"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                  step.done ? "bg-ok text-white" : isNext ? "bg-primary text-white" : "bg-raised text-muted"
                }`}
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${step.done ? "text-muted line-through" : "text-ink"}`}>
                  {step.title}
                  {step.done && <span className="sr-only"> (hecho)</span>}
                </p>
                {!step.done && <p className="mt-0.5 text-xs text-muted">{step.description}</p>}
                {!step.done && (
                  <Link
                    href={step.href}
                    className={`mt-2 inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold transition-colors touch-manipulation ${
                      isNext
                        ? "bg-primary text-white hover:bg-primary-hover"
                        : "border border-line bg-surface text-ink hover:bg-canvas"
                    }`}
                  >
                    {step.action} →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

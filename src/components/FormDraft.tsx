"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { browserStorage, clearDraft, describeDraftAge, draftKey, purgeStaleDrafts, readDraft, writeDraft } from "@/lib/form-draft";

const DraftScopeContext = createContext<string | null>(null);

/** Identifica el usuario y el taller de la sesión: los borradores de otra persona u otro taller nunca se ofrecen. */
export function DraftScopeProvider({ scope, children }: { scope: string | null; children: ReactNode }) {
  return <DraftScopeContext.Provider value={scope}>{children}</DraftScopeContext.Provider>;
}

const SAVE_DELAY_MS = 600;

type Pending<T> = { data: T; savedAt: number };

/**
 * Guarda en el navegador lo que la persona va escribiendo y, al volver a abrir el formulario, ofrece recuperarlo.
 *
 * - `value` es lo que se guarda (sin contraseñas ni secretos). Debe poder convertirse a JSON.
 * - No guarda mientras el formulario siga igual que al abrirse, y borra el borrador si la persona deja todo como estaba.
 * - Si hay un borrador esperando respuesta, no lo pisa.
 * - `failed`: el servidor devolvió un error. Si el formulario se cierra tras enviarse sin error (la acción redirige), el
 *   borrador se borra; si hubo error, se conserva.
 */
export function useFormDraft<T>({ form, recordId, value, onRestore, failed = false, enabled = true }: { form: string; recordId?: string | null; value: T; onRestore: (data: T) => void; failed?: boolean; /** false: el formulario no guarda borrador (p. ej. cuando viene precargado desde otra pantalla). */ enabled?: boolean }) {
  const scope = useContext(DraftScopeContext);
  const serialized = JSON.stringify(value);
  const baseline = useRef(serialized);
  const key = scope && enabled ? draftKey(scope, form, recordId) : null;
  const [pending, setPending] = useState<Pending<T> | null>(null);
  const [ready, setReady] = useState(false);
  const submitted = useRef(false);
  const failedRef = useRef(failed);
  const onRestoreRef = useRef(onRestore);
  useEffect(() => { failedRef.current = failed; onRestoreRef.current = onRestore; });

  useEffect(() => {
    if (!scope || !key) return;
    const storage = browserStorage();
    purgeStaleDrafts(storage, scope);
    const found = readDraft<T>(storage, key);
    // El almacenamiento del navegador solo se puede leer después de hidratar; el estado se actualiza en el siguiente ciclo.
    const timer = setTimeout(() => {
      // Un borrador idéntico a lo que ya hay en pantalla no aporta nada: se descarta en silencio.
      if (found && JSON.stringify(found.data) !== baseline.current) setPending(found);
      else if (found) clearDraft(storage, key);
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [scope, key]);

  useEffect(() => {
    if (!key || !ready || pending) return;
    const storage = browserStorage();
    if (serialized === baseline.current) { clearDraft(storage, key); return; }
    const timer = setTimeout(() => { writeDraft(storage, key, JSON.parse(serialized) as T); }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [serialized, key, ready, pending]);

  useEffect(() => () => {
    if (key && submitted.current && !failedRef.current) clearDraft(browserStorage(), key);
  }, [key]);

  const restore = useCallback(() => {
    if (!pending) return;
    onRestoreRef.current(pending.data);
    setPending(null);
  }, [pending]);

  const discard = useCallback(() => {
    if (key) clearDraft(browserStorage(), key);
    setPending(null);
  }, [key]);

  const markSubmitted = useCallback(() => { submitted.current = true; }, []);

  return { pending, restore, discard, markSubmitted };
}

export function DraftBanner({ pending, onRestore, onDiscard, what = "este formulario" }: { pending: { savedAt: number } | null; onRestore: () => void; onDiscard: () => void; what?: string }) {
  if (!pending) return null;
  return (
    <div data-testid="draft-banner" role="status" className="enter flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-primary/25 bg-primary-soft/50 px-4 py-3">
      <p className="min-w-0 text-sm text-ink">Tienes un borrador de {what} guardado {describeDraftAge(pending.savedAt)} en este dispositivo.</p>
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" data-testid="draft-restore" onClick={onRestore} className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Continuar donde quedé</button>
        <button type="button" data-testid="draft-discard" onClick={onDiscard} className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-raised px-4 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">Descartar</button>
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext, useId, useRef, useState } from "react";

const CloseDialogContext = createContext<() => void>(() => {});
/** Permite que un formulario dentro de la ventana la cierre cuando termina bien. */
export const useCloseDialog = () => useContext(CloseDialogContext);

/**
 * Una ventana emergente (el `<dialog>` nativo: se cierra con Esc, atrapa el foco y bloquea el fondo). El contenido se monta al abrir
 * y se desmonta al cerrar, así cada vez empieza limpio, sin restos de lo anterior.
 */
export function Dialog({ triggerLabel, triggerClassName, title, description, children }: { triggerLabel: string; triggerClassName: string; title: string; description?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId(); // cada ventana tiene el suyo: con un id fijo todas quedaban nombradas con el título de la primera de la página
  const [open, setOpen] = useState(false);
  const show = () => { setOpen(true); ref.current?.showModal(); };
  const close = () => ref.current?.close();

  return (
    <>
      <button type="button" onClick={show} className={triggerClassName}>{triggerLabel}</button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }} // un clic en el fondo oscuro cierra
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface p-0 text-ink shadow-[0_24px_60px_rgba(91,37,56,0.22)] backdrop:bg-ink/40"
      >
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-xl text-ink [overflow-wrap:anywhere]">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-faint [overflow-wrap:anywhere]">{description}</p> : null}
            </div>
            <button type="button" onClick={close} aria-label="Cerrar" className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-faint transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-4 w-4"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 sm:px-6">
            <CloseDialogContext.Provider value={close}>{open ? children : null}</CloseDialogContext.Provider>
          </div>
        </div>
      </dialog>
    </>
  );
}

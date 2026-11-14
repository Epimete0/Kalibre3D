"use client";

import { useRef, useState } from "react";
import { parseSlicerFile, type ParsedSlicerFile } from "@/lib/slicer-file-parser";

type SlicerFileImportButtonProps = {
  onParsed: (parsed: ParsedSlicerFile) => void;
  compact?: boolean;
};

export function SlicerFileImportButton({ onParsed, compact = false }: SlicerFileImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setStatus(null);
    try {
      const parsed = await parseSlicerFile(file);
      onParsed(parsed);
      const parts: string[] = [];
      if (parsed.grams !== null) parts.push(`${parsed.grams} g`);
      if (parsed.printMinutes !== null) parts.push(`${parsed.printMinutes} min`);
      if (parsed.material) parts.push(parsed.material);
      if (parsed.colorsCount && parsed.colorsCount > 1) parts.push(`${parsed.colorsCount} colores`);
      setStatus({
        tone: "ok",
        text: `Leído en tu navegador (${parsed.slicer ?? "laminador"}): ${parts.join(" · ") || parsed.fileName}.`,
      });
    } catch (err) {
      setStatus({
        tone: "error",
        text: err instanceof Error ? err.message : "No se pudo leer el archivo del laminador.",
      });
    }
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <input
        ref={inputRef}
        type="file"
        accept=".3mf,.gcode,.gco,.gc"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void handleFile(file);
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 ${
          compact ? "py-2" : "py-2.5"
        } text-xs transition ${
          dragging
            ? "border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/30"
            : "border-slate-300 bg-slate-50/80 dark:border-zinc-700 dark:bg-zinc-900/50"
        }`}
      >
        <span className="text-slate-600 dark:text-zinc-400">
          Importa un archivo <strong className="font-medium text-slate-800 dark:text-zinc-200">.3mf</strong> laminado o{" "}
          <strong className="font-medium text-slate-800 dark:text-zinc-200">.gcode</strong> (se lee solo en tu navegador).
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition hover:border-cyan-500 hover:text-cyan-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-cyan-500"
        >
          Elegir archivo
        </button>
      </div>
      {status ? (
        <p
          className={`text-xs ${
            status.tone === "ok"
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-rose-700 dark:text-rose-400"
          }`}
          role={status.tone === "error" ? "alert" : "status"}
        >
          {status.text}
        </p>
      ) : null}
    </div>
  );
}

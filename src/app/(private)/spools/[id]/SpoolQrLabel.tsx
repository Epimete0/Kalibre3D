"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Card } from "@/components/ui";
import { MATERIAL_LABEL } from "@/lib/catalog-presentation";

/**
 * Generador QR compacto (ISO/IEC 18004 Versión 4-L, 33×33 módulos, modo Byte, máscara 0)
 * para renderizar la etiqueta de bobina 100% en el navegador sin dependencias externas.
 */
function buildQrMatrixV4L(text: string): boolean[][] {
  const size = 33;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, dark: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = dark;
      reserved[r][c] = true;
    }
  };

  // Patrones de búsqueda (7×7 + separador blanco)
  const placeFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        setModule(r, c, inOuter && (onBorder || inCenter));
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Patrón de alineación en (26, 26)
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      setModule(26 + dr, 26 + dc, dark);
    }
  }

  // Líneas de sincronización (fila 6 y columna 6)
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // Módulo oscuro fijo e información de formato (Nivel L = 01, Máscara 0 = 000 -> 0x77C4)
  setModule(size - 8, 8, true);
  const formatBits = 0x77c4;
  const formatCoordsA: Array<[number, number]> = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const formatCoordsB: Array<[number, number]> = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    const [r1, c1] = formatCoordsA[i];
    const [r2, c2] = formatCoordsB[i];
    setModule(r1, c1, bit);
    setModule(r2, c2, bit);
  }

  // Codificación de datos (Modo Byte = 0100, hasta 78 bytes en 80 codewords)
  const bytes = Array.from(new TextEncoder().encode(text)).slice(0, 78);
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);
  for (let i = 0; i < 4 && bits.length < 80 * 8; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataWords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataWords.push(byte);
  }
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataWords.length < 80) {
    dataWords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Reed-Solomon GF(256) con polinomio 0x11d y 20 bytes de corrección
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]);

  let gen = [1];
  for (let i = 0; i < 20; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= gfMul(gen[j], exp[i]);
    }
    gen = next;
  }

  const ecWords = new Array(20).fill(0);
  for (const d of dataWords) {
    const factor = d ^ ecWords[0];
    ecWords.shift();
    ecWords.push(0);
    for (let j = 0; j < 20; j++) {
      ecWords[j] ^= gfMul(gen[j + 1], factor);
    }
  }

  const allWords = [...dataWords, ...ecWords];
  const allBits: number[] = [];
  for (const w of allWords) {
    for (let i = 7; i >= 0; i--) allBits.push((w >> i) & 1);
  }

  // Colocación en zig-zag de 2 columnas con máscara 0: (r + c) % 2 === 0
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!reserved[r][c]) {
          const dataBit = bitIdx < allBits.length ? allBits[bitIdx++] === 1 : false;
          const maskBit = (r + c) % 2 === 0;
          matrix[r][c] = dataBit !== maskBit;
        }
      }
    }
    upward = !upward;
  }

  return matrix;
}

export function SpoolQrLabel({
  spoolId,
  material,
  color,
  brand,
  totalGrams,
  tareGrams,
}: {
  spoolId: string;
  material: string;
  color: string;
  brand: string | null;
  totalGrams: number;
  tareGrams: number;
}) {
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://kalibre.app"
  );

  const targetUrl = `${origin}/spools/${spoolId}`;
  const matrix = useMemo(() => buildQrMatrixV4L(targetUrl), [targetUrl]);
  const materialLabel = MATERIAL_LABEL[material as keyof typeof MATERIAL_LABEL] ?? material;

  return (
    <Card className="p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-ink">Etiqueta QR para el carrete</h2>
          <p className="text-xs text-muted">
            Pégala en la bobina para abrir su ficha con la cámara del celular o recordar la tara en la balanza.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-9 items-center justify-center rounded-xl border border-line bg-surface px-3 text-xs font-semibold text-ink shadow-xs transition-all hover:bg-raised hover:border-line-strong"
        >
          Imprimir etiqueta
        </button>
      </div>

      <div className="inline-flex items-center gap-4 rounded-xl border border-line-strong bg-white p-3.5 text-zinc-900 shadow-xs">
        <svg
          viewBox="0 0 37 37"
          className="h-24 w-24 shrink-0"
          role="img"
          aria-label={`Código QR de la bobina ${materialLabel} ${color}`}
          shapeRendering="crispEdges"
        >
          <rect width="37" height="37" fill="#ffffff" />
          {matrix.map((row, r) =>
            row.map((dark, c) =>
              dark ? <rect key={`${r}-${c}`} x={c + 2} y={r + 2} width={1} height={1} fill="#111111" /> : null
            )
          )}
        </svg>

        <div className="min-w-0 space-y-1 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Kalibre 3D · Bobina
          </div>
          <div className="text-base font-bold text-zinc-900 leading-tight">
            {materialLabel} · {color}
          </div>
          {brand && <div className="text-xs font-medium text-zinc-600">Marca: {brand}</div>}
          <div className="pt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-zinc-800">
            <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5">
              Inicial: {totalGrams} g
            </span>
            {tareGrams > 0 && (
              <span className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5">
                Carrete vacío: {tareGrams} g
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-zinc-400">
            #{spoolId.slice(0, 8)}
          </div>
        </div>
      </div>
    </Card>
  );
}

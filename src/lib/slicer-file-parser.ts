import { unzipSync } from "fflate";
import type { Material } from "@/lib/catalog-presentation";

export type ParsedSlicerFile = {
  fileName: string;
  suggestedName: string;
  grams: number | null;
  printMinutes: number | null;
  colorsCount: number | null;
  purgeGrams: number | null;
  material: Material | null;
  slicer: string | null;
};

const MAX_3MF_BYTES = 100 * 1024 * 1024;
const GCODE_SLICE_BYTES = 256 * 1024;

/** Limpia el nombre del archivo para sugerir un título legible de pieza. */
export function cleanPieceNameFromFileName(fileName: string): string {
  const withoutExt = fileName
    .replace(/\.(gcode\.3mf|3mf|gcode|gco|gc|bgcode)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withoutExt.slice(0, 80);
}

/** Normaliza strings de material de laminadores (ej. "Bambu PLA Basic", "PETG-CF") al catálogo interno. */
export function mapSlicerMaterial(raw: string | null | undefined): Material | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper.includes("PLA")) return "PLA";
  if (upper.includes("PETG")) return "PETG";
  if (upper.includes("ASA")) return "ASA";
  if (upper.includes("ABS")) return "ABS";
  if (upper.includes("TPU") || upper.includes("FLEX") || upper.includes("TPE")) return "TPU";
  if (upper.trim().length > 0) return "OTHER";
  return null;
}

/** Parsea duraciones humanas ("1h 23m 45s", "2d 3h 5m", "45m 10s") a minutos redondeados. */
function parseHumanDurationMinutes(raw: string): number | null {
  let seconds = 0;
  let matched = false;
  const day = raw.match(/(\d+)\s*d\b/i);
  const hour = raw.match(/(\d+)\s*h\b/i);
  const min = raw.match(/(\d+)\s*m\b/i);
  const sec = raw.match(/(\d+)\s*s\b/i);
  if (day) {
    seconds += Number(day[1]) * 86400;
    matched = true;
  }
  if (hour) {
    seconds += Number(hour[1]) * 3600;
    matched = true;
  }
  if (min) {
    seconds += Number(min[1]) * 60;
    matched = true;
  }
  if (sec) {
    seconds += Number(sec[1]);
    matched = true;
  }
  if (!matched || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 60));
}

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseXmlAttr(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}=["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? decodeXmlEntities(m[1]) : null;
}

type PartialParse = Omit<ParsedSlicerFile, "fileName" | "suggestedName">;

function parseBambuSliceInfoXml(xml: string): PartialParse {
  let grams: number | null = null;
  let printMinutes: number | null = null;
  let purgeGrams: number | null = null;
  let objectName: string | null = null;

  const metaTags = xml.match(/<metadata\b[^>]*>/gi) ?? [];
  for (const tag of metaTags) {
    const key = parseXmlAttr(tag, "key");
    const val = parseXmlAttr(tag, "value");
    if (!key || val === null) continue;
    if (key === "prediction") {
      const sec = Number(val);
      if (Number.isFinite(sec) && sec > 0) {
        printMinutes = Math.max(1, Math.round(sec / 60));
      }
    } else if (key === "weight") {
      const w = Number(val);
      if (Number.isFinite(w) && w > 0) {
        grams = roundOneDecimal(w);
      }
    } else if (key === "flush_weight" || key === "wipe_tower_weight") {
      const f = Number(val);
      if (Number.isFinite(f) && f > 0) {
        purgeGrams = Math.round((purgeGrams ?? 0) + f);
      }
    }
  }

  const filamentTags = xml.match(/<filament\b[^>]*>/gi) ?? [];
  let activeFilaments = 0;
  let filamentGramsSum = 0;
  let primaryMaterial: Material | null = null;

  for (const tag of filamentTags) {
    const usedStr = parseXmlAttr(tag, "used_g");
    const typeStr = parseXmlAttr(tag, "type");
    const used = usedStr ? Number(usedStr) : 0;
    if (Number.isFinite(used) && used > 0) {
      activeFilaments += 1;
      filamentGramsSum += used;
      if (!primaryMaterial) {
        primaryMaterial = mapSlicerMaterial(typeStr);
      }
    } else if (!primaryMaterial && typeStr) {
      primaryMaterial = mapSlicerMaterial(typeStr);
    }
  }

  if (grams === null && filamentGramsSum > 0) {
    grams = roundOneDecimal(filamentGramsSum);
  }

  const objectTag = xml.match(/<object\b[^>]*name=["']([^"']+)["']/i);
  if (objectTag) {
    objectName = decodeXmlEntities(objectTag[1]).trim() || null;
  }

  // Si weight excluye purga pero used_g suma todo (o viceversa), no inventamos purga negativa.
  if (purgeGrams === null && grams !== null && filamentGramsSum > grams + 0.5) {
    purgeGrams = Math.round(filamentGramsSum - grams);
  }

  return {
    grams,
    printMinutes,
    colorsCount: activeFilaments > 0 ? activeFilaments : null,
    purgeGrams: purgeGrams && purgeGrams > 0 ? purgeGrams : null,
    material: primaryMaterial,
    slicer: objectName ? "Bambu Studio / OrcaSlicer" : "Bambu Studio / OrcaSlicer",
  };
}

/** Extrae métricas desde comentarios de cabecera y pie de un archivo .gcode. */
export function parseGcodeText(text: string): PartialParse {
  let slicer: string | null = null;
  if (/generated by Bambu Studio/i.test(text)) slicer = "Bambu Studio";
  else if (/generated by OrcaSlicer/i.test(text)) slicer = "OrcaSlicer";
  else if (/generated by PrusaSlicer/i.test(text)) slicer = "PrusaSlicer";
  else if (/generated by SuperSlicer/i.test(text)) slicer = "SuperSlicer";
  else if (/generated by AnycubicSlicer/i.test(text)) slicer = "Anycubic Slicer";
  else if (/Generated with Cura_SteamEngine|;FLAVOR:/i.test(text)) slicer = "Cura";

  let grams: number | null = null;
  let colorsCount: number | null = null;
  let purgeGrams: number | null = null;
  let printMinutes: number | null = null;
  let material: Material | null = null;

  // 1) Tiempo de impresión (Cura ";TIME:seconds", Bambu/Orca "; total estimated time:", Prusa "; estimated printing time")
  const curaTime = text.match(/^;TIME:(\d+)/m);
  if (curaTime) {
    const sec = Number(curaTime[1]);
    if (Number.isFinite(sec) && sec > 0) {
      printMinutes = Math.max(1, Math.round(sec / 60));
    }
  }
  if (printMinutes === null) {
    const bambuTime = text.match(/^;\s*total estimated time:\s*([^\r\n;]+)/im);
    if (bambuTime) {
      printMinutes = parseHumanDurationMinutes(bambuTime[1]);
    }
  }
  if (printMinutes === null) {
    const prusaTime = text.match(/^;\s*estimated printing time(?:\s*\([^)]*\))?\s*[:=]\s*([^\r\n;]+)/im);
    if (prusaTime) {
      printMinutes = parseHumanDurationMinutes(prusaTime[1]);
    }
  }

  // 2) Gramos por extrusor (Prusa/Orca/Bambu): "; filament used [g] = 12.4, 8.1"
  const perFilamentGrams = text.match(/^;\s*filament used \[g\]\s*[:=]\s*([^\r\n]+)/im);
  if (perFilamentGrams) {
    const nums = perFilamentGrams[1]
      .split(/[,;]/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length > 0) {
      grams = roundOneDecimal(nums.reduce((acc, n) => acc + n, 0));
      colorsCount = nums.length;
    }
  }

  // 3) Peso total explícito (Bambu "; total filament weight [g] : 42.1" o Cura ";Filament weight = 42.1")
  if (grams === null) {
    const totalWeight =
      text.match(/^;\s*total filament (?:used|weight)\s*\[g\]\s*[:=]\s*([\d.]+)/im) ??
      text.match(/^;\s*Filament weight\s*[:=]\s*([\d.]+)/im);
    if (totalWeight) {
      const w = Number(totalWeight[1]);
      if (Number.isFinite(w) && w > 0) grams = roundOneDecimal(w);
    }
  }

  // 4) Purga / flushed filament cuando el laminador lo reporta
  const flushMatch = text.match(/^;\s*(?:flushed|flush|wipe tower)\s*(?:filament)?\s*(?:weight)?\s*\[g\]\s*[:=]\s*([\d.]+)/im);
  if (flushMatch) {
    const f = Number(flushMatch[1]);
    if (Number.isFinite(f) && f > 0) purgeGrams = Math.round(f);
  }

  // 5) Tipo de material
  const matMatch = text.match(/^;\s*filament_type\s*[:=]\s*([^\r\n]+)/im);
  if (matMatch) {
    const tokens = matMatch[1]
      .split(/[;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) {
      material = mapSlicerMaterial(tokens[0]);
    }
  }

  return { grams, printMinutes, colorsCount, purgeGrams, material, slicer };
}

function mergePartialParses(primary: PartialParse, fallback: PartialParse): PartialParse {
  return {
    grams: primary.grams ?? fallback.grams,
    printMinutes: primary.printMinutes ?? fallback.printMinutes,
    colorsCount: primary.colorsCount ?? fallback.colorsCount,
    purgeGrams: primary.purgeGrams ?? fallback.purgeGrams,
    material: primary.material ?? fallback.material,
    slicer: primary.slicer ?? fallback.slicer,
  };
}

/** Decodifica archivos .3mf o .gcode directamente en memoria (navegador o Node). */
export function parseSlicerBytes(fileName: string, bytes: Uint8Array): ParsedSlicerFile {
  const lower = fileName.toLowerCase();
  const suggestedName = cleanPieceNameFromFileName(fileName);

  if (lower.endsWith(".3mf")) {
    if (bytes.byteLength > MAX_3MF_BYTES) {
      throw new Error("El archivo .3mf supera los 100 MB permitidos en el navegador.");
    }
    let metadataFiles: Record<string, Uint8Array>;
    try {
      metadataFiles = unzipSync(bytes, {
        filter: (entry) => /Metadata\/.+\.(config|xml|json)$/i.test(entry.name),
      });
    } catch {
      throw new Error("No se pudo abrir el archivo .3mf. Verifica que no esté dañado.");
    }

    const decoder = new TextDecoder("utf-8", { fatal: false });
    let result: PartialParse = {
      grams: null,
      printMinutes: null,
      colorsCount: null,
      purgeGrams: null,
      material: null,
      slicer: null,
    };

    const sliceInfoEntry = Object.entries(metadataFiles).find(([name]) =>
      /Metadata\/slice_info\.config$/i.test(name),
    );
    if (sliceInfoEntry) {
      result = mergePartialParses(result, parseBambuSliceInfoXml(decoder.decode(sliceInfoEntry[1])));
    }

    const projectSettingsEntry = Object.entries(metadataFiles).find(([name]) =>
      /Metadata\/project_settings\.config$/i.test(name),
    );
    if (projectSettingsEntry && !result.material) {
      try {
        const json = JSON.parse(decoder.decode(projectSettingsEntry[1])) as { filament_type?: string[] | string };
        const ft = Array.isArray(json.filament_type) ? json.filament_type[0] : json.filament_type;
        const mat = mapSlicerMaterial(ft);
        if (mat) result = { ...result, material: mat };
      } catch {
        // Ignorar project_settings inválido
      }
    }

    // Si slice_info no entregó gramos ni tiempo, intentamos leer el .gcode embebido dentro del .3mf.
    if (result.grams === null && result.printMinutes === null) {
      const gcodeFiles = unzipSync(bytes, {
        filter: (entry) => /\.gcode$/i.test(entry.name),
      });
      const firstGcode = Object.values(gcodeFiles)[0];
      if (firstGcode) {
        const head = decoder.decode(firstGcode.subarray(0, GCODE_SLICE_BYTES));
        const tailStart = Math.max(0, firstGcode.byteLength - GCODE_SLICE_BYTES);
        const tail = tailStart > GCODE_SLICE_BYTES ? decoder.decode(firstGcode.subarray(tailStart)) : "";
        result = mergePartialParses(result, parseGcodeText(`${head}\n${tail}`));
      }
    }

    if (result.grams === null && result.printMinutes === null) {
      throw new Error(
        "Este .3mf no incluye datos de laminado (peso o tiempo). Exporta el archivo laminado (.gcode.3mf o .gcode) desde tu slicer.",
      );
    }

    return { fileName, suggestedName, ...result };
  }

  if (lower.endsWith(".gcode") || lower.endsWith(".gco") || lower.endsWith(".gc")) {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    const parsed = parseGcodeText(decoder.decode(bytes));
    if (parsed.grams === null && parsed.printMinutes === null) {
      throw new Error(
        "No encontramos peso ni tiempo de impresión en los comentarios de este .gcode.",
      );
    }
    return { fileName, suggestedName, ...parsed };
  }

  throw new Error("Formato no compatible. Sube un archivo .3mf (laminado) o .gcode.");
}

/** Lee solo cabecera y pie en .gcode grandes para no saturar la memoria del navegador. */
export async function parseSlicerFile(file: File): Promise<ParsedSlicerFile> {
  const lower = file.name.toLowerCase();
  if ((lower.endsWith(".gcode") || lower.endsWith(".gco") || lower.endsWith(".gc")) && file.size > GCODE_SLICE_BYTES * 2) {
    const headBuf = await file.slice(0, GCODE_SLICE_BYTES).arrayBuffer();
    const tailBuf = await file.slice(file.size - GCODE_SLICE_BYTES, file.size).arrayBuffer();
    const head = new Uint8Array(headBuf);
    const tail = new Uint8Array(tailBuf);
    const combined = new Uint8Array(head.byteLength + 1 + tail.byteLength);
    combined.set(head, 0);
    combined[head.byteLength] = 10; // "\n"
    combined.set(tail, head.byteLength + 1);
    return parseSlicerBytes(file.name, combined);
  }
  const buffer = await file.arrayBuffer();
  return parseSlicerBytes(file.name, new Uint8Array(buffer));
}

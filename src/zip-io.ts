import { unzipSync } from "fflate";

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Extract all files from a ZIP archive returned by ElevenLabs stem separation. */
export function extractZipArchive(bytes: Uint8Array): ZipEntry[] {
  const unzipped = unzipSync(bytes);
  return Object.entries(unzipped)
    .filter(([name]) => !name.endsWith("/"))
    .map(([name, data]) => ({ name, data }));
}

/** Guess stem label from ZIP entry filename for track naming and mixer balance. */
export function stemLabelFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  return base.replace(/[_-]+/g, " ").trim() || "Stem";
}

export function stemVolumeLevel(filename: string): number {
  const lower = filename.toLowerCase();
  if (lower.includes("vocal")) return 0.9;
  if (lower.includes("drum")) return 0.85;
  if (lower.includes("bass")) return 0.8;
  if (lower.includes("guitar") || lower.includes("piano") || lower.includes("synth")) return 0.78;
  if (lower.includes("other") || lower.includes("instrument")) return 0.75;
  return 0.8;
}

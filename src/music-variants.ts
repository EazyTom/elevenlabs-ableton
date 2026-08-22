import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { parseMusicOutputFormat } from "./audio-output-formats.js";
import { generateMusic, type MusicRequest } from "./elevenlabs-client.js";
import { musicForceInstrumental } from "./music-prompt.js";
import type { MusicModalResult } from "./types.js";

export const MAX_MUSIC_VARIANTS = 10;
export const DEFAULT_MUSIC_VARIANTS = 1;

export function clampMusicVariants(count: number | undefined): number {
  if (!Number.isFinite(count)) return DEFAULT_MUSIC_VARIANTS;
  return Math.min(MAX_MUSIC_VARIANTS, Math.max(1, Math.round(count!)));
}

export function musicRequestFromModal(modal: MusicModalResult, prompt: string): MusicRequest {
  return {
    prompt,
    musicLengthMs: modal.musicLengthMs,
    autoDuration: modal.autoDuration,
    forceInstrumental: musicForceInstrumental(modal),
    modelId: modal.modelId,
    loop: modal.loop,
    promptInfluence: modal.promptInfluence,
    negativePrompt: modal.negativePrompt,
    outputFormat: parseMusicOutputFormat(modal.outputFormat),
    seed: modal.seed,
  };
}

export async function generateMusicVariants(
  client: ElevenLabsClient,
  request: MusicRequest,
  count: number,
  onProgress?: (index: number, total: number) => void,
): Promise<Uint8Array[]> {
  const total = clampMusicVariants(count);
  const variants: Uint8Array[] = [];

  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total);
    const bytes = await generateMusic(client, request);
    if (bytes.byteLength < 200) {
      throw new Error(`Variant ${i + 1} is empty or too small to use.`);
    }
    variants.push(bytes);
  }

  return variants;
}

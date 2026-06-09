import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { parseAudioOutputFormat } from "./audio-output-formats.js";
import { generateSfx, type SfxRequest } from "./elevenlabs-client.js";
import type { SfxModalResult } from "./types.js";

export const MAX_SFX_VARIANTS = 10;
export const DEFAULT_SFX_VARIANTS = 1;

export function clampSfxVariants(count: number | undefined): number {
  if (!Number.isFinite(count)) return DEFAULT_SFX_VARIANTS;
  return Math.min(MAX_SFX_VARIANTS, Math.max(1, Math.round(count!)));
}

export function sfxRequestFromModal(modal: SfxModalResult): SfxRequest {
  return {
    text: modal.text!,
    durationSeconds: modal.durationSeconds,
    autoDuration: modal.autoDuration,
    promptInfluence: modal.promptInfluence,
    negativePrompt: modal.negativePrompt,
    outputFormat: parseAudioOutputFormat(modal.outputFormat),
    loop: modal.loop,
    modelId: modal.modelId,
  };
}

export async function generateSfxVariants(
  client: ElevenLabsClient,
  request: SfxRequest,
  count: number,
  onProgress?: (index: number, total: number) => void,
): Promise<Uint8Array[]> {
  const total = clampSfxVariants(count);
  const variants: Uint8Array[] = [];

  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total);
    const bytes = await generateSfx(client, request);
    if (bytes.byteLength < 200) {
      throw new Error(`Variant ${i + 1} is empty or too small to use.`);
    }
    variants.push(bytes);
  }

  return variants;
}

export async function generateAllSfxVariants(
  client: ElevenLabsClient,
  modal: SfxModalResult,
  onProgress?: (index: number, total: number) => void,
): Promise<Uint8Array[]> {
  const count = clampSfxVariants(modal.variants);
  const request = sfxRequestFromModal(modal);
  return generateSfxVariants(client, request, count, onProgress);
}

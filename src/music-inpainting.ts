/** music_v2 inpainting chunk-plan builders. */

export const MIN_CHUNK_MS = 3_000;
export const MAX_CHUNK_MS = 120_000;
export const MAX_CHUNKS = 30;
export const MAX_CONDITIONING_MS = 30_000;
export const MIN_RANGE_MS = 50;

export type ContextAdherence = "low" | "medium" | "high";
export type ConditionStrength = "low" | "medium" | "high" | "xhigh";

export interface GenerationChunk {
  text: string;
  durationMs: number;
  positiveStyles: string[];
  negativeStyles?: string[];
  contextAdherence?: ContextAdherence;
  conditioningRef?: { songId: string; range: { startMs: number; endMs: number } };
  conditionStrength?: ConditionStrength;
}

export interface AudioRefChunk {
  songId: string;
  range: { startMs: number; endMs: number };
}

export type CompositionPlanChunk = GenerationChunk | AudioRefChunk;

export interface MusicV2CompositionPlan {
  chunks: CompositionPlanChunk[];
}

export function clampChunkDurationMs(ms: number): number {
  return Math.min(MAX_CHUNK_MS, Math.max(MIN_CHUNK_MS, Math.round(ms)));
}

export function clampRangeMs(startMs: number, endMs: number, maxDurationMs?: number): { startMs: number; endMs: number } {
  const start = Math.max(0, Math.round(startMs));
  let end = Math.max(start + MIN_RANGE_MS, Math.round(endMs));
  if (maxDurationMs !== undefined) {
    end = Math.min(end, start + maxDurationMs);
  }
  const duration = end - start;
  if (duration < MIN_RANGE_MS) {
    throw new Error(`Audio range must be at least ${MIN_RANGE_MS}ms.`);
  }
  return { startMs: start, endMs: end };
}

export function assertChunkPlan(plan: MusicV2CompositionPlan): void {
  if (plan.chunks.length === 0) {
    throw new Error("Composition plan must include at least one chunk.");
  }
  if (plan.chunks.length > MAX_CHUNKS) {
    throw new Error(`Composition plan exceeds ${MAX_CHUNKS} chunks.`);
  }
  for (const chunk of plan.chunks) {
    if ("durationMs" in chunk) {
      if (chunk.durationMs < MIN_CHUNK_MS || chunk.durationMs > MAX_CHUNK_MS) {
        throw new Error(`Chunk duration must be ${MIN_CHUNK_MS}–${MAX_CHUNK_MS}ms.`);
      }
      if (chunk.conditioningRef) {
        const refDuration =
          chunk.conditioningRef.range.endMs - chunk.conditioningRef.range.startMs;
        if (refDuration > MAX_CONDITIONING_MS) {
          throw new Error(`Conditioning reference cannot exceed ${MAX_CONDITIONING_MS}ms.`);
        }
      }
    } else {
      const duration = chunk.range.endMs - chunk.range.startMs;
      if (duration < MIN_RANGE_MS) {
        throw new Error(`Audio reference range must be at least ${MIN_RANGE_MS}ms.`);
      }
    }
  }
}

function generationChunk(
  text: string,
  durationMs: number,
  positiveStyles: string[],
  negativeStyles: string[] = [],
  options?: {
    contextAdherence?: ContextAdherence;
    conditioningRef?: GenerationChunk["conditioningRef"];
    conditionStrength?: ConditionStrength;
  },
): GenerationChunk {
  return {
    text,
    durationMs: clampChunkDurationMs(durationMs),
    positiveStyles: positiveStyles.length ? positiveStyles : ["electronic music"],
    negativeStyles,
    contextAdherence: options?.contextAdherence ?? "high",
    conditioningRef: options?.conditioningRef,
    conditionStrength: options?.conditionStrength,
  };
}

function audioRefChunk(songId: string, startMs: number, endMs: number): AudioRefChunk {
  const range = clampRangeMs(startMs, endMs);
  return { songId, range };
}

/** Wrap kept audio between new intro and outro generation chunks. */
export function buildExtendPlan(
  songId: string,
  keepStartMs: number,
  keepEndMs: number,
  introMs: number,
  outroMs: number,
  positiveStyles: string[],
): MusicV2CompositionPlan {
  const plan: MusicV2CompositionPlan = {
    chunks: [
      generationChunk("[Intro]", introMs, positiveStyles),
      audioRefChunk(songId, keepStartMs, keepEndMs),
      generationChunk("[Outro]", outroMs, positiveStyles),
    ],
  };
  assertChunkPlan(plan);
  return plan;
}

/** Keep everything outside the selection; regenerate the middle. */
export function buildRegenerateSectionPlan(
  songId: string,
  totalDurationMs: number,
  regenStartMs: number,
  regenEndMs: number,
  regenText: string,
  positiveStyles: string[],
  negativeStyles: string[] = [],
): MusicV2CompositionPlan {
  const chunks: CompositionPlanChunk[] = [];
  if (regenStartMs > 0) {
    chunks.push(audioRefChunk(songId, 0, regenStartMs));
  }
  chunks.push(
    generationChunk(regenText, regenEndMs - regenStartMs, positiveStyles, negativeStyles),
  );
  if (regenEndMs < totalDurationMs) {
    chunks.push(audioRefChunk(songId, regenEndMs, totalDurationMs));
  }
  const plan = { chunks };
  assertChunkPlan(plan);
  return plan;
}

/** slice → glue → same slice for a seamless loop. */
export function buildSeamlessLoopPlan(
  songId: string,
  sliceStartMs: number,
  sliceEndMs: number,
  glueMs: number,
  positiveStyles: string[],
): MusicV2CompositionPlan {
  const plan: MusicV2CompositionPlan = {
    chunks: [
      audioRefChunk(songId, sliceStartMs, sliceEndMs),
      generationChunk("[Glue]", glueMs, positiveStyles),
      audioRefChunk(songId, sliceStartMs, sliceEndMs),
    ],
  };
  assertChunkPlan(plan);
  return plan;
}

/** New song conditioned on a slice of stored audio. */
export function buildSimilarPlan(
  songId: string,
  conditioningStartMs: number,
  conditioningEndMs: number,
  verseText: string,
  verseDurationMs: number,
  chorusText: string,
  chorusDurationMs: number,
  positiveStyles: string[],
  negativeStyles: string[] = [],
): MusicV2CompositionPlan {
  const conditioning = clampRangeMs(
    conditioningStartMs,
    conditioningEndMs,
    MAX_CONDITIONING_MS,
  );
  const plan: MusicV2CompositionPlan = {
    chunks: [
      generationChunk(verseText, verseDurationMs, positiveStyles, negativeStyles, {
        conditioningRef: { songId, range: conditioning },
        conditionStrength: "high",
      }),
      generationChunk(chorusText, chorusDurationMs, positiveStyles, negativeStyles),
    ],
  };
  assertChunkPlan(plan);
  return plan;
}

/** Split a comma-separated style string into plan styles. */
export function stylesFromPrompt(prompt: string): string[] {
  return prompt
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

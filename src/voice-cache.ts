import type { VoiceSummary } from "./elevenlabs-client.js";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { voices: VoiceSummary[]; fetchedAt: number } | null = null;

export function getCachedVoices(): VoiceSummary[] | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) {
    cache = null;
    return null;
  }
  return cache.voices;
}

export function setCachedVoices(voices: VoiceSummary[]): void {
  cache = { voices, fetchedAt: Date.now() };
}

export function invalidateVoiceCache(): void {
  cache = null;
}

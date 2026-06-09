/** ElevenLabs `/v1/music` `music_length_ms` bounds (3 s – 10 min). */
export const MUSIC_MIN_LENGTH_MS = 3_000;
export const MUSIC_MAX_LENGTH_MS = 600_000;
export const MUSIC_MIN_LENGTH_SEC = 3;
export const MUSIC_MAX_LENGTH_SEC = 600;
/** Slider default when the user turns off auto duration. */
export const MUSIC_DEFAULT_MANUAL_LENGTH_SEC = 30;

export function clampMusicLengthMs(ms: number | undefined): number | undefined {
  if (ms === undefined || !Number.isFinite(ms)) return undefined;
  return Math.min(MUSIC_MAX_LENGTH_MS, Math.max(MUSIC_MIN_LENGTH_MS, Math.round(ms)));
}

export function clampMusicLengthSec(sec: number | undefined): number | undefined {
  if (sec === undefined || !Number.isFinite(sec)) return undefined;
  return Math.min(MUSIC_MAX_LENGTH_SEC, Math.max(MUSIC_MIN_LENGTH_SEC, Math.round(sec)));
}

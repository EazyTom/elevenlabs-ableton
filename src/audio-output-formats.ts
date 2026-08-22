export const DEFAULT_AUDIO_OUTPUT_FORMAT = "mp3_44100_128" as const;

/** Default for music_v2 when output_format is auto. */
export const DEFAULT_MUSIC_OUTPUT_FORMAT = "mp3_48000_192" as const;

/** Output formats supported by SFX and general audio import. */
export type AudioOutputFormat =
  | "mp3_44100_128"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_192"
  | "pcm_44100"
  | "opus_48000_128";

/** Music compose supports additional 48 kHz MP3 bitrates and auto. */
export type MusicOutputFormat =
  | AudioOutputFormat
  | "mp3_48000_192"
  | "mp3_48000_240"
  | "mp3_48000_320"
  | "auto";

const SFX_ALLOWED_FORMATS = new Set<string>([
  "mp3_44100_128",
  "mp3_44100_64",
  "mp3_44100_96",
  "mp3_44100_192",
  "pcm_44100",
  "opus_48000_128",
]);

const MUSIC_ALLOWED_FORMATS = new Set<string>([
  ...SFX_ALLOWED_FORMATS,
  "mp3_48000_192",
  "mp3_48000_240",
  "mp3_48000_320",
  "auto",
]);

export function parseAudioOutputFormat(value: string | undefined): AudioOutputFormat {
  if (value && SFX_ALLOWED_FORMATS.has(value)) {
    return value as AudioOutputFormat;
  }
  return DEFAULT_AUDIO_OUTPUT_FORMAT;
}

export function parseMusicOutputFormat(value: string | undefined): MusicOutputFormat {
  if (value === "auto") return "auto";
  if (value && MUSIC_ALLOWED_FORMATS.has(value) && value !== "auto") {
    return value as MusicOutputFormat;
  }
  return DEFAULT_MUSIC_OUTPUT_FORMAT;
}

export function importFilename(prefix: string, format: AudioOutputFormat | MusicOutputFormat): string {
  if (format.startsWith("pcm_")) return `${prefix}.wav`;
  if (format.startsWith("opus_")) return `${prefix}.opus`;
  return `${prefix}.mp3`;
}

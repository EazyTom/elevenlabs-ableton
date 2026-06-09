export const DEFAULT_AUDIO_OUTPUT_FORMAT = "mp3_44100_128" as const;

export type AudioOutputFormat =
  | "mp3_44100_128"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_192"
  | "pcm_44100"
  | "opus_48000_128";

const ALLOWED_FORMATS = new Set<string>([
  "mp3_44100_128",
  "mp3_44100_64",
  "mp3_44100_96",
  "mp3_44100_192",
  "pcm_44100",
  "opus_48000_128",
]);

export function parseAudioOutputFormat(value: string | undefined): AudioOutputFormat {
  if (value && ALLOWED_FORMATS.has(value)) {
    return value as AudioOutputFormat;
  }
  return DEFAULT_AUDIO_OUTPUT_FORMAT;
}

export function importFilename(prefix: string, format: AudioOutputFormat): string {
  if (format.startsWith("pcm_")) return `${prefix}.wav`;
  if (format.startsWith("opus_")) return `${prefix}.opus`;
  return `${prefix}.mp3`;
}

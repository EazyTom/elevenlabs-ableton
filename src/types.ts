export interface TextVoiceModalResult {
  cancelled?: boolean;
  text?: string;
  voiceId?: string;
  /** TTS voice settings (ElevenLabs voice_settings). */
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export interface SfxModalResult {
  cancelled?: boolean;
  text?: string;
  durationSeconds?: number;
  autoDuration?: boolean;
  promptInfluence?: number;
  negativePrompt?: string;
  outputFormat?: string;
  loop?: boolean;
  modelId?: "eleven_text_to_sound_v1" | "eleven_text_to_sound_v2";
  /** Number of generations to create (1–10); user picks one when > 1. */
  variants?: number;
}

export interface SfxVariantPickerResult {
  cancelled?: boolean;
  variantIndex?: number;
}

export interface VoiceOnlyModalResult {
  cancelled?: boolean;
  voiceId?: string;
}

export interface MusicModalResult {
  cancelled?: boolean;
  prompt?: string;
  musicLengthMs?: number;
  autoDuration?: boolean;
  forceInstrumental?: boolean;
  /** Genre toggle keys (trap, house, epic, dark, …). */
  genres?: string[];
  tempoBpm?: number;
  loop?: boolean;
  promptInfluence?: number;
  negativePrompt?: string;
  outputFormat?: string;
  modelId?: "music_v1" | "music_v2";
  /** Number of generations to create (1–10); user picks one when > 1. */
  variants?: number;
}

export interface ImportClipArgs {
  startTime?: number;
  duration?: number;
  isWarped?: boolean;
}

export interface DialogueModalResult {
  cancelled?: boolean;
  voiceA?: string;
  voiceB?: string;
  voiceC?: string;
  script?: string;
  stability?: number;
}

export interface DrumPadConfig {
  padIndex: number;
  enabled: boolean;
  type: string;
  stylePhrase: string;
  characteristics: string;
  durationSeconds: number;
  autoDuration?: boolean;
}

export interface DrumRackSfxModalResult {
  cancelled?: boolean;
  promptInfluence?: number;
  outputFormat?: string;
  modelId?: "eleven_text_to_sound_v1" | "eleven_text_to_sound_v2";
  /** First pad MIDI note (default 36 = C1). */
  startMidiNote?: number;
  pads?: DrumPadConfig[];
  overwriteOccupied?: boolean;
  /** Musical key for kick pitch character (e.g. "F", "C#"). */
  kickKey?: string;
  /** Musical key for snare pitch character (e.g. "F", "C#"). */
  snareKey?: string;
}

export interface ApiKeyModalResult {
  cancelled?: boolean;
  apiKey?: string;
  clearKey?: boolean;
}

export interface CloneVoiceModalResult {
  cancelled?: boolean;
  name?: string;
}

export interface AlignLyricsModalResult {
  cancelled?: boolean;
  transcript?: string;
}

export interface PronunciationModalResult {
  cancelled?: boolean;
  dictionaryName?: string;
  stringToReplace?: string;
  alias?: string;
  setActive?: boolean;
}

export interface StemSeparationModalResult {
  cancelled?: boolean;
  stemVariationId?: "two_stems_v1" | "six_stems_v1";
}

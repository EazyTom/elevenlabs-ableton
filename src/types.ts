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
  promptInfluence?: number;
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
  forceInstrumental?: boolean;
  /** Genre toggle keys (trap, house, epic, …). */
  genres?: string[];
  tempoBpm?: number;
  highEnergy?: boolean;
  darkMood?: boolean;
  loFi?: boolean;
  loop?: boolean;
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
  script?: string;
}

export interface DrumRackSfxModalResult {
  cancelled?: boolean;
  midiNote?: number;
  text?: string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
  modelId?: "eleven_text_to_sound_v1" | "eleven_text_to_sound_v2";
  variants?: number;
  autoLoadPads?: boolean;
  /** Generate kick, snare, hats, rimshot, clap, and 808 across C0+. */
  buildDrumKit?: boolean;
  /** First pad MIDI note for auto-load / kit (default 0 = C0). */
  startMidiNote?: number;
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

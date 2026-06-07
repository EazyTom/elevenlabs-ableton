export interface TextVoiceModalResult {
  cancelled?: boolean;
  text?: string;
  voiceId?: string;
}

export interface SfxModalResult {
  cancelled?: boolean;
  text?: string;
  durationSeconds?: number;
  promptInfluence?: number;
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

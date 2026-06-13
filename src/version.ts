/**
 * Extension versioning — bump EXTENSION_VERSION on each release.
 * Feature versions track when individual capabilities were introduced or changed.
 */
export const EXTENSION_VERSION = "0.6.0";

export const FEATURE_VERSIONS = {
  ttsClipSlot: "1.0.0",
  ttsArrangement: "1.0.0",
  sfx: "1.1.0",
  music: "1.1.0",
  batchTts: "1.0.0",
  voiceChanger: "1.0.0",
  vocalIsolation: "1.1.0",
  transcribe: "1.0.0",
  simplerTts: "1.0.0",
  simplerSfx: "1.0.0",
  postImportFx: "1.0.0",
  voicePicker: "1.0.0",
  dialogue: "1.0.0",
  drumRackSfx: "1.1.0",
  transcribeToMidi: "1.0.0",
  stemSeparation: "1.0.0",
  voiceClone: "1.0.0",
  forcedAlignmentMidi: "1.0.0",
  pronunciationDictionary: "1.0.0",
} as const;

export type FeatureId = keyof typeof FEATURE_VERSIONS;

export const FEATURE_LABELS: Record<FeatureId, string> = {
  ttsClipSlot: "Text-to-Speech → Clip Slot",
  ttsArrangement: "Text-to-Speech → Arrangement Selection",
  sfx: "Sound Effects → Clip",
  music: "Music Generation → Clip",
  batchTts: "Batch Text-to-Speech → Session Clip Slots",
  voiceChanger: "Voice Changer (Speech-to-Speech)",
  vocalIsolation: "Voice Isolation",
  transcribe: "Transcribe (Scribe STT)",
  simplerTts: "Text-to-Speech → Simpler Sample",
  simplerSfx: "SFX → Simpler Sample",
  postImportFx: "Post-Import Vocal FX (mixer + device)",
  voicePicker: "Voice Library Picker (voices.search)",
  dialogue: "Text-to-Dialogue → Clip",
  drumRackSfx: "Drum Rack SFX → Pad Samples",
  transcribeToMidi: "Transcribe → MIDI Lyric Markers",
  stemSeparation: "Music Stem Separation → Multi-Track",
  voiceClone: "Instant Voice Clone from Live Audio",
  forcedAlignmentMidi: "Forced Alignment → MIDI Lyrics",
  pronunciationDictionary: "Pronunciation Dictionary Manager",
};

export function logExtensionInfo(): void {
  console.log(
    `[elevenlabs-ableton] v${EXTENSION_VERSION} active — ${Object.keys(FEATURE_VERSIONS).length} features`,
  );
}

/**
 * Extension versioning — bump EXTENSION_VERSION on each release.
 * Feature versions track when individual capabilities were introduced or changed.
 */
export const EXTENSION_VERSION = "0.8.1";

export const FEATURE_VERSIONS = {
  ttsClipSlot: "1.0.0",
  ttsArrangement: "1.0.0",
  sfx: "1.2.0",
  music: "1.4.0",
  batchTts: "1.0.0",
  voiceChanger: "1.0.0",
  vocalIsolation: "1.1.0",
  transcribe: "1.0.0",
  simplerTts: "1.0.0",
  simplerSfx: "1.0.0",
  postImportFx: "1.0.0",
  voicePicker: "1.0.0",
  dialogue: "1.0.0",
  drumRackSfx: "1.2.0",
  transcribeToMidi: "1.0.0",
  stemSeparation: "1.0.0",
  voiceClone: "1.0.0",
  forcedAlignmentMidi: "1.0.0",
  pronunciationDictionary: "1.0.0",
  ttsModelPicker: "1.1.0",
  musicInpainting: "1.1.0",
  musicExtend: "1.0.0",
  musicRegenerate: "1.0.0",
  musicLoop: "1.0.0",
  musicSimilar: "1.0.0",
  musicV25: "1.0.0",
  dialogueV4: "1.0.0",
  arrangementLocators: "1.0.0",
  clipMetadata: "1.0.0",
  voiceFilters: "1.0.0",
  musicPart: "1.0.0",
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
  ttsModelPicker: "TTS Model Picker (Flash / Eleven v4 / Eleven v3)",
  musicInpainting: "Music Inpainting (music_v2)",
  musicExtend: "Extend Music (inpainting)",
  musicRegenerate: "Regenerate Section (inpainting)",
  musicLoop: "Make Seamless Loop (inpainting)",
  musicSimilar: "Generate Similar Music (inpainting)",
  musicV25: "Music v2.5 generation",
  dialogueV4: "Eleven v4 dialogue",
  arrangementLocators: "Arrangement locators",
  clipMetadata: "Generated clip names and colors",
  voiceFilters: "Voice picker filters",
  musicPart: "Music part control (full, instrumental, solo, vocal)",
};

export function logExtensionInfo(details?: { language?: string }): void {
  const language = details?.language ? ` language=${details.language}` : "";
  console.log(
    `[elevenlabs-ableton] v${EXTENSION_VERSION} active — ${Object.keys(FEATURE_VERSIONS).length} features — node ${process.version}${language}`,
  );
}

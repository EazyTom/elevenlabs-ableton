import type { ContextMenuScope, ExtensionContext } from "@ableton-extensions/sdk";

export const NS = "elevenlabs-ableton";

export const COMMANDS = {
  ttsClipSlot: `${NS}.ttsClipSlot`,
  ttsArrangement: `${NS}.ttsArrangement`,
  sfxClipSlot: `${NS}.sfxClipSlot`,
  sfxArrangement: `${NS}.sfxArrangement`,
  musicClipSlot: `${NS}.musicClipSlot`,
  musicArrangement: `${NS}.musicArrangement`,
  batchTts: `${NS}.batchTts`,
  voiceChanger: `${NS}.voiceChanger`,
  vocalIsolation: `${NS}.vocalIsolation`,
  vocalIsolationClipSlot: `${NS}.vocalIsolationClipSlot`,
  vocalIsolationClip: `${NS}.vocalIsolationClip`,
  transcribeClip: `${NS}.transcribeClip`,
  transcribeArrangement: `${NS}.transcribeArrangement`,
  simplerTts: `${NS}.simplerTts`,
  simplerSfx: `${NS}.simplerSfx`,
  dialogueClipSlot: `${NS}.dialogueClipSlot`,
  dialogueArrangement: `${NS}.dialogueArrangement`,
  drumRackSfx: `${NS}.drumRackSfx`,
  drumRackSfxClipSlot: `${NS}.drumRackSfxClipSlot`,
  manageApiKey: `${NS}.manageApiKey`,
  transcribeToMidiClip: `${NS}.transcribeToMidiClip`,
  transcribeToMidiArrangement: `${NS}.transcribeToMidiArrangement`,
  alignToMidiClip: `${NS}.alignToMidiClip`,
  alignToMidiArrangement: `${NS}.alignToMidiArrangement`,
  cloneVoiceClip: `${NS}.cloneVoiceClip`,
  cloneVoiceArrangement: `${NS}.cloneVoiceArrangement`,
  stemSeparationClip: `${NS}.stemSeparationClip`,
  stemSeparationArrangement: `${NS}.stemSeparationArrangement`,
  pronunciationRule: `${NS}.pronunciationRule`,
  musicExtendClip: `${NS}.musicExtendClip`,
  musicExtendArrangement: `${NS}.musicExtendArrangement`,
  musicRegenerateClip: `${NS}.musicRegenerateClip`,
  musicRegenerateArrangement: `${NS}.musicRegenerateArrangement`,
  musicLoopClip: `${NS}.musicLoopClip`,
  musicLoopArrangement: `${NS}.musicLoopArrangement`,
  musicSimilarClip: `${NS}.musicSimilarClip`,
  musicSimilarArrangement: `${NS}.musicSimilarArrangement`,
} as const;

export interface MenuEntry {
  scope: ContextMenuScope<"1.0.0">;
  title: string;
  commandId: string;
}

export const MENU_ENTRIES: MenuEntry[] = [
  { scope: "ClipSlot", title: "Generate Text-to-Speech (ElevenLabs)", commandId: COMMANDS.ttsClipSlot },
  { scope: "ClipSlot", title: "Generate SFX (ElevenLabs)", commandId: COMMANDS.sfxClipSlot },
  { scope: "ClipSlot", title: "Generate Music (ElevenLabs)", commandId: COMMANDS.musicClipSlot },
  { scope: "ClipSlot", title: "Generate Dialogue (ElevenLabs)", commandId: COMMANDS.dialogueClipSlot },
  { scope: "ClipSlot", title: "Isolate Voice (ElevenLabs)", commandId: COMMANDS.vocalIsolationClipSlot },
  { scope: "ClipSlot", title: "Generate Drum Rack SFX (ElevenLabs)", commandId: COMMANDS.drumRackSfxClipSlot },
  { scope: "ClipSlotSelection", title: "Batch Text-to-Speech (ElevenLabs)", commandId: COMMANDS.batchTts },
  { scope: "AudioTrack.ArrangementSelection", title: "Generate Text-to-Speech (ElevenLabs)", commandId: COMMANDS.ttsArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Generate SFX (ElevenLabs)", commandId: COMMANDS.sfxArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Generate Music (ElevenLabs)", commandId: COMMANDS.musicArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Change Voice (ElevenLabs)", commandId: COMMANDS.voiceChanger },
  { scope: "AudioTrack.ArrangementSelection", title: "Isolate Voice (ElevenLabs)", commandId: COMMANDS.vocalIsolation },
  { scope: "AudioTrack.ArrangementSelection", title: "Transcribe (ElevenLabs Scribe)", commandId: COMMANDS.transcribeArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Generate Dialogue (ElevenLabs)", commandId: COMMANDS.dialogueArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Transcribe to MIDI Lyrics (ElevenLabs)", commandId: COMMANDS.transcribeToMidiArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Align Lyrics to MIDI (ElevenLabs)", commandId: COMMANDS.alignToMidiArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Clone Voice from Selection (ElevenLabs)", commandId: COMMANDS.cloneVoiceArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Separate Stems (ElevenLabs)", commandId: COMMANDS.stemSeparationArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Extend Music (ElevenLabs)", commandId: COMMANDS.musicExtendArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Regenerate Section (ElevenLabs)", commandId: COMMANDS.musicRegenerateArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Make Seamless Loop (ElevenLabs)", commandId: COMMANDS.musicLoopArrangement },
  { scope: "AudioTrack.ArrangementSelection", title: "Generate Similar Music (ElevenLabs)", commandId: COMMANDS.musicSimilarArrangement },
  { scope: "AudioClip", title: "Transcribe (ElevenLabs Scribe)", commandId: COMMANDS.transcribeClip },
  { scope: "AudioClip", title: "Transcribe to MIDI Lyrics (ElevenLabs)", commandId: COMMANDS.transcribeToMidiClip },
  { scope: "AudioClip", title: "Align Lyrics to MIDI (ElevenLabs)", commandId: COMMANDS.alignToMidiClip },
  { scope: "AudioClip", title: "Clone Voice from Clip (ElevenLabs)", commandId: COMMANDS.cloneVoiceClip },
  { scope: "AudioClip", title: "Isolate Voice (ElevenLabs)", commandId: COMMANDS.vocalIsolationClip },
  { scope: "AudioClip", title: "Separate Stems (ElevenLabs)", commandId: COMMANDS.stemSeparationClip },
  { scope: "AudioClip", title: "Extend Music (ElevenLabs)", commandId: COMMANDS.musicExtendClip },
  { scope: "AudioClip", title: "Regenerate Section (ElevenLabs)", commandId: COMMANDS.musicRegenerateClip },
  { scope: "AudioClip", title: "Make Seamless Loop (ElevenLabs)", commandId: COMMANDS.musicLoopClip },
  { scope: "AudioClip", title: "Generate Similar Music (ElevenLabs)", commandId: COMMANDS.musicSimilarClip },
  { scope: "AudioTrack", title: "Add Pronunciation Rule (ElevenLabs)", commandId: COMMANDS.pronunciationRule },
  { scope: "DrumRack", title: "Generate Drum Rack SFX (ElevenLabs)", commandId: COMMANDS.drumRackSfx },
  { scope: "DrumRack", title: "Manage ElevenLabs API Key", commandId: COMMANDS.manageApiKey },
  { scope: "AudioTrack", title: "Manage ElevenLabs API Key", commandId: COMMANDS.manageApiKey },
  { scope: "Simpler", title: "Generate Text-to-Speech Sample (ElevenLabs)", commandId: COMMANDS.simplerTts },
  { scope: "Simpler", title: "Generate SFX Sample (ElevenLabs)", commandId: COMMANDS.simplerSfx },
];

export function registerContextMenus(context: ExtensionContext<"1.0.0">): void {
  for (const entry of MENU_ENTRIES) {
    void context.ui.registerContextMenuAction(entry.scope, entry.title, entry.commandId);
  }
}

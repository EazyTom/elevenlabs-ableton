import "./install-globals.js";

import type { ArrangementSelection, ClipSlotSelection, Handle } from "@ableton-extensions/sdk";
import {
  AudioClip,
  AudioTrack,
  ClipSlot,
  DrumRack,
  initialize,
  Simpler,
  type ActivationContext,
} from "@ableton-extensions/sdk";

import { resolveAudioPathForClip } from "./audio-io.js";
import {
  arrangementClipArgs,
  getPrimaryAudioTrack,
  resolveHandle,
  selectionDuration,
  type ExtensionContext,
} from "./live-selection.js";
import {
  importGeneratedAudio,
  pipelineAlignToMidi,
  pipelineCloneVoice,
  pipelineDialogue,
  pipelineDrumRackSfx,
  pipelineMusic,
  pipelinePronunciationRule,
  pipelineSfx,
  pipelineSimplerSfx,
  pipelineSimplerTts,
  pipelineStemSeparation,
  pipelineTranscribe,
  pipelineTranscribeToMidi,
  pipelineTts,
  pipelineVocalIsolation,
  pipelineVoiceChanger,
  withElevenLabsProgress,
} from "./pipelines.js";
import {
  promptAlignLyrics,
  promptCloneVoice,
  promptDialogue,
  promptDrumRackSfx,
  promptMusic,
  promptPronunciationRule,
  promptSfx,
  promptStemSeparation,
  promptTts,
  promptVoice,
  showTranscript,
} from "./ui.js";
import { DEFAULT_VOICE_ID, generateTts } from "./elevenlabs-client.js";
import { getActivePronunciationDictionary, loadStorageConfig } from "./storage.js";
import { EXTENSION_VERSION, logExtensionInfo } from "./version.js";

const NS = "elevenlabs-ableton";

const COMMANDS = {
  ttsClipSlot: `${NS}.ttsClipSlot`,
  ttsArrangement: `${NS}.ttsArrangement`,
  sfxClipSlot: `${NS}.sfxClipSlot`,
  sfxArrangement: `${NS}.sfxArrangement`,
  musicClipSlot: `${NS}.musicClipSlot`,
  musicArrangement: `${NS}.musicArrangement`,
  batchTts: `${NS}.batchTts`,
  voiceChanger: `${NS}.voiceChanger`,
  vocalIsolation: `${NS}.vocalIsolation`,
  transcribeClip: `${NS}.transcribeClip`,
  transcribeArrangement: `${NS}.transcribeArrangement`,
  simplerTts: `${NS}.simplerTts`,
  simplerSfx: `${NS}.simplerSfx`,
  dialogueClipSlot: `${NS}.dialogueClipSlot`,
  dialogueArrangement: `${NS}.dialogueArrangement`,
  drumRackSfx: `${NS}.drumRackSfx`,
  transcribeToMidiClip: `${NS}.transcribeToMidiClip`,
  transcribeToMidiArrangement: `${NS}.transcribeToMidiArrangement`,
  alignToMidiClip: `${NS}.alignToMidiClip`,
  alignToMidiArrangement: `${NS}.alignToMidiArrangement`,
  cloneVoiceClip: `${NS}.cloneVoiceClip`,
  cloneVoiceArrangement: `${NS}.cloneVoiceArrangement`,
  stemSeparationClip: `${NS}.stemSeparationClip`,
  stemSeparationArrangement: `${NS}.stemSeparationArrangement`,
  pronunciationRule: `${NS}.pronunciationRule`,
} as const;

function runSafe(fn: () => Promise<void>): void {
  void fn().catch((err) => console.error(`[elevenlabs-ableton v${EXTENSION_VERSION}]`, err));
}

function register(context: ExtensionContext, commandId: string, handler: (arg: unknown) => void): void {
  context.commands.registerCommand(commandId, handler);
}

function registerMenus(context: ExtensionContext): void {
  const menu = context.ui.registerContextMenuAction.bind(context.ui);

  menu("ClipSlot", "Generate TTS (ElevenLabs)", COMMANDS.ttsClipSlot);
  menu("ClipSlot", "Generate SFX (ElevenLabs)", COMMANDS.sfxClipSlot);
  menu("ClipSlot", "Generate Music (ElevenLabs)", COMMANDS.musicClipSlot);
  menu("ClipSlot", "Generate Dialogue (ElevenLabs)", COMMANDS.dialogueClipSlot);
  menu("ClipSlotSelection", "Batch TTS (ElevenLabs)", COMMANDS.batchTts);

  menu("AudioTrack.ArrangementSelection", "Generate TTS (ElevenLabs)", COMMANDS.ttsArrangement);
  menu("AudioTrack.ArrangementSelection", "Generate SFX (ElevenLabs)", COMMANDS.sfxArrangement);
  menu("AudioTrack.ArrangementSelection", "Generate Music (ElevenLabs)", COMMANDS.musicArrangement);
  menu("AudioTrack.ArrangementSelection", "Change Voice (ElevenLabs)", COMMANDS.voiceChanger);
  menu("AudioTrack.ArrangementSelection", "Isolate Vocals (ElevenLabs)", COMMANDS.vocalIsolation);
  menu("AudioTrack.ArrangementSelection", "Transcribe (ElevenLabs Scribe)", COMMANDS.transcribeArrangement);
  menu("AudioTrack.ArrangementSelection", "Generate Dialogue (ElevenLabs)", COMMANDS.dialogueArrangement);
  menu("AudioTrack.ArrangementSelection", "Transcribe to MIDI Lyrics (ElevenLabs)", COMMANDS.transcribeToMidiArrangement);
  menu("AudioTrack.ArrangementSelection", "Align Lyrics to MIDI (ElevenLabs)", COMMANDS.alignToMidiArrangement);
  menu("AudioTrack.ArrangementSelection", "Clone Voice from Selection (ElevenLabs)", COMMANDS.cloneVoiceArrangement);
  menu("AudioTrack.ArrangementSelection", "Separate Stems (ElevenLabs)", COMMANDS.stemSeparationArrangement);

  menu("AudioClip", "Transcribe (ElevenLabs Scribe)", COMMANDS.transcribeClip);
  menu("AudioClip", "Transcribe to MIDI Lyrics (ElevenLabs)", COMMANDS.transcribeToMidiClip);
  menu("AudioClip", "Align Lyrics to MIDI (ElevenLabs)", COMMANDS.alignToMidiClip);
  menu("AudioClip", "Clone Voice from Clip (ElevenLabs)", COMMANDS.cloneVoiceClip);
  menu("AudioClip", "Separate Stems (ElevenLabs)", COMMANDS.stemSeparationClip);

  menu("AudioTrack", "Add Pronunciation Rule (ElevenLabs)", COMMANDS.pronunciationRule);

  menu("DrumRack", "Generate SFX for Pad (ElevenLabs)", COMMANDS.drumRackSfx);
  menu("Simpler", "Generate TTS Sample (ElevenLabs)", COMMANDS.simplerTts);
  menu("Simpler", "Generate SFX Sample (ElevenLabs)", COMMANDS.simplerSfx);
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");
  logExtensionInfo();

  register(context, COMMANDS.ttsClipSlot, (arg) => {
    runSafe(async () => {
      const modal = await promptTts(context);
      if (!modal) return;
      await pipelineTts(context, modal, resolveHandle(context, arg as Handle, ClipSlot), {});
    });
  });

  register(context, COMMANDS.ttsArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const modal = await promptTts(context);
      if (!modal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineTts(context, modal, track, arrangementClipArgs(selection), true);
    });
  });

  register(context, COMMANDS.sfxClipSlot, (arg) => {
    runSafe(async () => {
      const modal = await promptSfx(context);
      if (!modal) return;
      await pipelineSfx(context, modal, resolveHandle(context, arg as Handle, ClipSlot), {});
    });
  });

  register(context, COMMANDS.sfxArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const modal = await promptSfx(context);
      if (!modal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineSfx(context, modal, track, arrangementClipArgs(selection));
    });
  });

  register(context, COMMANDS.musicClipSlot, (arg) => {
    runSafe(async () => {
      const modal = await promptMusic(context);
      if (!modal) return;
      await pipelineMusic(context, modal, resolveHandle(context, arg as Handle, ClipSlot), {});
    });
  });

  register(context, COMMANDS.musicArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const modal = await promptMusic(context);
      if (!modal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineMusic(context, modal, track, arrangementClipArgs(selection));
    });
  });

  register(context, COMMANDS.batchTts, (arg) => {
    runSafe(async () => {
      const selection = arg as ClipSlotSelection;
      const modal = await promptTts(context);
      if (!modal) return;

      const slots = selection.selected_clip_slots.map((h) =>
        resolveHandle(context, h, ClipSlot),
      );
      if (!slots.length) return;

      await withElevenLabsProgress(context, "ElevenLabs Batch TTS", async (client, update, signal) => {
        if (signal.aborted) return;
        update("Generating speech", 35);
        const config = await loadStorageConfig(context.environment.storageDirectory);
        const activeDict = getActivePronunciationDictionary(config);
        const bytes = await generateTts(client, {
          text: modal.text!,
          voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
          pronunciationDictionaryLocators: activeDict
            ? [{ pronunciationDictionaryId: activeDict.id, versionId: activeDict.versionId }]
            : undefined,
        });
        if (signal.aborted) return;

        for (let i = 0; i < slots.length; i++) {
          if (signal.aborted) return;
          update(`Importing slot ${i + 1} of ${slots.length}`, 40 + Math.round((i / slots.length) * 55));
          await importGeneratedAudio(context, bytes, `elevenlabs-batch-tts-${i}.mp3`, slots[i]!, {});
        }
        update("Done", 100);
      });
    });
  });

  register(context, COMMANDS.voiceChanger, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const voiceModal = await promptVoice(context);
      if (!voiceModal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineVoiceChanger(
        context,
        track,
        selection.time_selection_start,
        selection.time_selection_end,
        voiceModal.voiceId!,
      );
    });
  });

  register(context, COMMANDS.vocalIsolation, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineVocalIsolation(
        context,
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
    });
  });

  register(context, COMMANDS.transcribeClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      const audioPath = await resolveAudioPathForClip(clip);
      if (!audioPath) return;
      await pipelineTranscribe(context, audioPath, (t) => showTranscript(context, t));
    });
  });

  register(context, COMMANDS.transcribeArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      const wavPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      await pipelineTranscribe(context, wavPath, (t) => showTranscript(context, t));
    });
  });

  register(context, COMMANDS.simplerTts, (arg) => {
    runSafe(async () => {
      const modal = await promptTts(context);
      if (!modal) return;
      await pipelineSimplerTts(context, resolveHandle(context, arg as Handle, Simpler), modal);
    });
  });

  register(context, COMMANDS.simplerSfx, (arg) => {
    runSafe(async () => {
      const modal = await promptSfx(context);
      if (!modal) return;
      await pipelineSimplerSfx(context, resolveHandle(context, arg as Handle, Simpler), modal);
    });
  });

  register(context, COMMANDS.dialogueClipSlot, (arg) => {
    runSafe(async () => {
      const modal = await promptDialogue(context);
      if (!modal) return;
      await pipelineDialogue(context, modal, resolveHandle(context, arg as Handle, ClipSlot), {});
    });
  });

  register(context, COMMANDS.dialogueArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const modal = await promptDialogue(context);
      if (!modal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineDialogue(context, modal, track, arrangementClipArgs(selection));
    });
  });

  register(context, COMMANDS.drumRackSfx, (arg) => {
    runSafe(async () => {
      const modal = await promptDrumRackSfx(context);
      if (!modal) return;
      await pipelineDrumRackSfx(context, resolveHandle(context, arg as Handle, DrumRack), modal);
    });
  });

  register(context, COMMANDS.transcribeToMidiClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      const audioPath = await resolveAudioPathForClip(clip);
      if (!audioPath) return;
      await pipelineTranscribeToMidi(context, audioPath, clip.startTime, clip.duration);
    });
  });

  register(context, COMMANDS.transcribeToMidiArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      const wavPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      const duration = selectionDuration(selection);
      await pipelineTranscribeToMidi(
        context,
        wavPath,
        selection.time_selection_start,
        duration > 0 ? duration : 4,
      );
    });
  });

  register(context, COMMANDS.alignToMidiClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      const audioPath = await resolveAudioPathForClip(clip);
      if (!audioPath) return;
      const modal = await promptAlignLyrics(context);
      if (!modal) return;
      await pipelineAlignToMidi(context, audioPath, modal, clip.startTime, clip.duration);
    });
  });

  register(context, COMMANDS.alignToMidiArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      const modal = await promptAlignLyrics(context);
      if (!modal) return;
      const wavPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      const duration = selectionDuration(selection);
      await pipelineAlignToMidi(
        context,
        wavPath,
        modal,
        selection.time_selection_start,
        duration > 0 ? duration : 4,
      );
    });
  });

  register(context, COMMANDS.cloneVoiceClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      const audioPath = await resolveAudioPathForClip(clip);
      if (!audioPath) return;
      const modal = await promptCloneVoice(context);
      if (!modal) return;
      await pipelineCloneVoice(context, audioPath, modal);
    });
  });

  register(context, COMMANDS.cloneVoiceArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      const modal = await promptCloneVoice(context);
      if (!modal) return;
      const wavPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      await pipelineCloneVoice(context, wavPath, modal);
    });
  });

  register(context, COMMANDS.stemSeparationClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      const audioPath = await resolveAudioPathForClip(clip);
      if (!audioPath) return;
      const modal = await promptStemSeparation(context);
      if (!modal) return;
      await pipelineStemSeparation(context, audioPath, modal, clip.startTime, clip.duration);
    });
  });

  register(context, COMMANDS.stemSeparationArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      const modal = await promptStemSeparation(context);
      if (!modal) return;
      const wavPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      const duration = selectionDuration(selection);
      await pipelineStemSeparation(
        context,
        wavPath,
        modal,
        selection.time_selection_start,
        duration > 0 ? duration : 4,
      );
    });
  });

  register(context, COMMANDS.pronunciationRule, () => {
    runSafe(async () => {
      const modal = await promptPronunciationRule(context);
      if (!modal) return;
      await pipelinePronunciationRule(context, modal);
    });
  });

  registerMenus(context);
}

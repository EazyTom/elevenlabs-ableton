import "./install-globals.js";

import type { ArrangementSelection, ClipSlotSelection, Handle } from "@ableton-extensions/sdk";
import {
  AudioClip,
  AudioTrack,
  DrumRack,
  initialize,
  Simpler,
  type ActivationContext,
} from "@ableton-extensions/sdk";

import { resolveAudioPathForClip } from "./audio-io.js";
import {
  arrangementClipArgs,
  audioClipSlotsFromSelection,
  getPrimaryAudioTrack,
  resolveAudioClipSlot,
  resolveHandle,
  selectionDuration,
  type ExtensionContext,
} from "./live-selection.js";
import { ensureDrumRackFromClipSlot } from "./drum-io.js";
import { COMMANDS, registerContextMenus } from "./menu-registry.js";
import {
  importGeneratedAudio,
  pipelineAlignToMidi,
  pipelineCloneVoice,
  pipelineDialogue,
  pipelineDrumRackSfx,
  pipelineMusic,
  pipelineMusicInpaint,
  pipelinePronunciationRule,
  pipelineSfx,
  pipelineSimplerSfx,
  pipelineSimplerTts,
  pipelineStemSeparation,
  pipelineTranscribe,
  pipelineTranscribeToMidi,
  pipelineTts,
  pipelineVocalIsolation,
  pipelineVocalIsolationClip,
  pipelineVocalIsolationClipSlot,
  pipelineVoiceChanger,
  withElevenLabsProgress,
} from "./pipelines.js";
import { isAudioTrack, isClipSlot } from "./sdk-objects.js";
import {
  promptAlignLyrics,
  promptCloneVoice,
  promptDialogue,
  promptDrumRackSfx,
  promptManageApiKey,
  promptMusic,
  promptMusicInpaint,
  showError,
  promptPronunciationRule,
  promptSfx,
  promptStemSeparation,
  promptTts,
  promptVoice,
  showTranscript,
} from "./ui.js";
import { DEFAULT_VOICE_ID, generateTts } from "./elevenlabs-client.js";
import { getActivePronunciationDictionary, loadStorageConfig } from "./storage.js";
import type { MusicInpaintMode } from "./types.js";
import { EXTENSION_VERSION, logExtensionInfo } from "./version.js";

function runSafe(fn: () => Promise<void>): void {
  void fn().catch((err) => console.error(`[elevenlabs-ableton v${EXTENSION_VERSION}]`, err));
}

function register(context: ExtensionContext, commandId: string, handler: (arg: unknown) => void): void {
  context.commands.registerCommand(commandId, handler);
}

function clipDurationMs(context: ExtensionContext, clip: AudioClip<"1.0.0">): number {
  const tempo = context.application.song.tempo;
  return Math.max(1, Math.round((clip.duration / tempo) * 60_000));
}

function resolveAudioTrackForClip(clip: AudioClip<"1.0.0">): AudioTrack<"1.0.0"> | null {
  const parent = clip.parent;
  if (isAudioTrack(parent)) return parent;
  if (isClipSlot(parent)) {
    const track = parent.parent;
    if (isAudioTrack(track)) return track;
  }
  return null;
}

async function handleMusicInpaintClip(
  context: ExtensionContext,
  clip: AudioClip<"1.0.0">,
  mode: MusicInpaintMode,
): Promise<void> {
  const audioPath = await resolveAudioPathForClip(clip);
  if (!audioPath) return;

  const track = resolveAudioTrackForClip(clip);
  if (!track) return;

  const totalDurationMs = clipDurationMs(context, clip);
  const modal = await promptMusicInpaint(context, mode, totalDurationMs / 1000);
  if (!modal) return;

  await pipelineMusicInpaint(
    context,
    mode,
    audioPath,
    totalDurationMs,
    modal,
    track,
    { startTime: clip.startTime, duration: clip.duration },
  );
}

async function handleMusicInpaintArrangement(
  context: ExtensionContext,
  selection: ArrangementSelection,
  mode: MusicInpaintMode,
): Promise<void> {
  const track = getPrimaryAudioTrack(context, selection);
  if (!track) return;

  const audioPath = await context.resources.renderPreFxAudio(
    track,
    selection.time_selection_start,
    selection.time_selection_end,
  );

  const durationBeats = selectionDuration(selection);
  const tempo = context.application.song.tempo;
  const totalDurationMs = Math.max(1, Math.round((durationBeats / tempo) * 60_000));

  const modal = await promptMusicInpaint(context, mode, totalDurationMs / 1000);
  if (!modal) return;

  await pipelineMusicInpaint(
    context,
    mode,
    audioPath,
    totalDurationMs,
    modal,
    track,
    arrangementClipArgs(selection),
  );
}

export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");
  logExtensionInfo();

  register(context, COMMANDS.ttsClipSlot, (arg) => {
    runSafe(async () => {
      const slot = resolveAudioClipSlot(context, arg as Handle);
      if (!slot) return;
      const modal = await promptTts(context);
      if (!modal) return;
      await pipelineTts(context, modal, slot, {});
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
      const slot = resolveAudioClipSlot(context, arg as Handle);
      if (!slot) return;
      const modal = await promptSfx(context);
      if (!modal) return;
      await pipelineSfx(context, modal, slot, {}, "session");
    });
  });

  register(context, COMMANDS.sfxArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const modal = await promptSfx(context);
      if (!modal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineSfx(context, modal, track, arrangementClipArgs(selection), "arrangement");
    });
  });

  register(context, COMMANDS.musicClipSlot, (arg) => {
    runSafe(async () => {
      const slot = resolveAudioClipSlot(context, arg as Handle);
      if (!slot) return;
      const modal = await promptMusic(context);
      if (!modal) return;
      await pipelineMusic(context, modal, slot, {}, "session");
    });
  });

  register(context, COMMANDS.musicArrangement, (arg) => {
    runSafe(async () => {
      const selection = arg as ArrangementSelection;
      const modal = await promptMusic(context);
      if (!modal) return;
      const track = getPrimaryAudioTrack(context, selection);
      if (!track) return;
      await pipelineMusic(context, modal, track, arrangementClipArgs(selection), "arrangement");
    });
  });

  register(context, COMMANDS.batchTts, (arg) => {
    runSafe(async () => {
      const selection = arg as ClipSlotSelection;
      const slots = audioClipSlotsFromSelection(context, selection);
      if (!slots.length) return;

      const modal = await promptTts(context);
      if (!modal) return;

      await withElevenLabsProgress(context, "ElevenLabs Batch Text-to-Speech", async (client, update, signal) => {
        if (signal.aborted) return;
        update("Generating speech", 35);
        const config = await loadStorageConfig(context.environment.storageDirectory);
        const activeDict = getActivePronunciationDictionary(config);
        const bytes = await generateTts(client, {
          text: modal.text!,
          voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
          modelId: modal.modelId,
          pronunciationDictionaryLocators: activeDict
            ? [{ pronunciationDictionaryId: activeDict.id, versionId: activeDict.versionId }]
            : undefined,
          speed: modal.speed,
          stability: modal.stability,
          similarityBoost: modal.similarityBoost,
          style: modal.style,
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

  register(context, COMMANDS.vocalIsolationClipSlot, (arg) => {
    runSafe(async () => {
      const slot = resolveAudioClipSlot(context, arg as Handle);
      if (!slot) return;
      await pipelineVocalIsolationClipSlot(context, slot);
    });
  });

  register(context, COMMANDS.vocalIsolationClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      await pipelineVocalIsolationClip(context, clip);
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
      const audioPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      await pipelineTranscribe(context, audioPath, (t) => showTranscript(context, t));
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
      const slot = resolveAudioClipSlot(context, arg as Handle);
      if (!slot) return;
      const modal = await promptDialogue(context);
      if (!modal) return;
      await pipelineDialogue(context, modal, slot, {});
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
      const drumRack = resolveHandle(context, arg as Handle, DrumRack);
      const modal = await promptDrumRackSfx(context, drumRack);
      if (!modal) return;
      await pipelineDrumRackSfx(context, drumRack, modal);
    });
  });

  register(context, COMMANDS.drumRackSfxClipSlot, (arg) => {
    runSafe(async () => {
      const drumRack = await ensureDrumRackFromClipSlot(context, arg as Handle);
      if (!drumRack) {
        await showError(
          context,
          "This clip slot is not on a MIDI track with a Drum Rack. Add a Drum Rack to the track first.",
        );
        return;
      }
      const modal = await promptDrumRackSfx(context, drumRack);
      if (!modal) return;
      await pipelineDrumRackSfx(context, drumRack, modal);
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
      const audioPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      const duration = selectionDuration(selection);
      await pipelineTranscribeToMidi(
        context,
        audioPath,
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
      const audioPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      const duration = selectionDuration(selection);
      await pipelineAlignToMidi(
        context,
        audioPath,
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
      const audioPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      await pipelineCloneVoice(context, audioPath, modal);
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
      const audioPath = await context.resources.renderPreFxAudio(
        track,
        selection.time_selection_start,
        selection.time_selection_end,
      );
      const duration = selectionDuration(selection);
      await pipelineStemSeparation(
        context,
        audioPath,
        modal,
        selection.time_selection_start,
        duration > 0 ? duration : 4,
      );
    });
  });

  register(context, COMMANDS.musicExtendClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      await handleMusicInpaintClip(context, clip, "extend");
    });
  });

  register(context, COMMANDS.musicExtendArrangement, (arg) => {
    runSafe(async () => {
      await handleMusicInpaintArrangement(context, arg as ArrangementSelection, "extend");
    });
  });

  register(context, COMMANDS.musicRegenerateClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      await handleMusicInpaintClip(context, clip, "regenerate");
    });
  });

  register(context, COMMANDS.musicRegenerateArrangement, (arg) => {
    runSafe(async () => {
      await handleMusicInpaintArrangement(context, arg as ArrangementSelection, "regenerate");
    });
  });

  register(context, COMMANDS.musicLoopClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      await handleMusicInpaintClip(context, clip, "loop");
    });
  });

  register(context, COMMANDS.musicLoopArrangement, (arg) => {
    runSafe(async () => {
      await handleMusicInpaintArrangement(context, arg as ArrangementSelection, "loop");
    });
  });

  register(context, COMMANDS.musicSimilarClip, (arg) => {
    runSafe(async () => {
      const clip = resolveHandle(context, arg as Handle, AudioClip);
      await handleMusicInpaintClip(context, clip, "similar");
    });
  });

  register(context, COMMANDS.musicSimilarArrangement, (arg) => {
    runSafe(async () => {
      await handleMusicInpaintArrangement(context, arg as ArrangementSelection, "similar");
    });
  });

  register(context, COMMANDS.pronunciationRule, () => {
    runSafe(async () => {
      const modal = await promptPronunciationRule(context);
      if (!modal) return;
      await pipelinePronunciationRule(context, modal);
    });
  });

  register(context, COMMANDS.manageApiKey, () => {
    runSafe(async () => {
      await promptManageApiKey(context);
    });
  });

  registerContextMenus(context);
}

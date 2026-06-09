import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  AudioClip,
  AudioTrack,
  ClipSlot,
  DrumRack,
  Simpler,
  TakeLane,
} from "@ableton-extensions/sdk";

import {
  importAndCreateClip,
  importBytesToSimpler,
  requireTempDirectory,
  resolveAudioPathForClip,
  writeTempAudio,
} from "./audio-io.js";
import {
  cloneVoiceFromAudio,
  convertVoice,
  createClient,
  createPronunciationRule,
  DEFAULT_VOICE_ID,
  forceAlignAudio,
  generateDialogue,
  generateMusic,
  generateSfx,
  generateTts,
  isolateVocals,
  resolveApiKey,
  separateMusicStems,
  transcribeAudio,
  transcribeWithWords,
  type PronunciationLocator,
  type StemVariationId,
} from "./elevenlabs-client.js";
import { parseDialogueScript } from "./dialogue.js";
import { findSimplerOnPad, assertPadRange, ensureSimplerOnPad } from "./drum-io.js";
import {
  buildDrumKitPiecePrompt,
  DRUM_KIT_PIECES,
  DRUM_RACK_START_NOTE,
  drumKitMidiNote,
} from "./drum-kit.js";
import type { ExtensionContext } from "./live-selection.js";
import { isAudioTrack, isClipSlot } from "./sdk-objects.js";
import { applyVocalPostFx, setTrackVolume } from "./live-io.js";
import { alignedWordsToLyricNotes, wordsToLyricNotes } from "./midi-io.js";
import {
  addClonedVoice,
  addPronunciationDictionary,
  getActivePronunciationDictionary,
  loadStorageConfig,
} from "./storage.js";
import { invalidateVoiceCache } from "./voice-cache.js";
import { extractZipArchive, stemLabelFromFilename, stemVolumeLevel } from "./zip-io.js";
import type { ImportClipArgs } from "./audio-io.js";
import type {
  AlignLyricsModalResult,
  CloneVoiceModalResult,
  DialogueModalResult,
  DrumRackSfxModalResult,
  MusicModalResult,
  PronunciationModalResult,
  SfxModalResult,
  StemSeparationModalResult,
  TextVoiceModalResult,
} from "./types.js";
import { parseAudioOutputFormat, importFilename } from "./audio-output-formats.js";
import { buildMusicPrompt } from "./music-prompt.js";
import { consecutiveClipSlotsFrom } from "./clip-io.js";
import {
  clampMusicVariants,
  generateMusicVariants,
  musicRequestFromModal,
} from "./music-variants.js";
import {
  clampSfxVariants,
  generateAllSfxVariants,
  generateSfxVariants,
  sfxRequestFromModal,
} from "./sfx-variants.js";
import { formatApiError } from "./api-errors.js";
import { promptSfxVariantPick, showError, showResult } from "./ui.js";

export async function withElevenLabsProgress(
  context: ExtensionContext,
  title: string,
  run: (
    client: ElevenLabsClient,
    update: (text: string, progress?: number) => void,
    abortSignal: AbortSignal,
  ) => Promise<void>,
): Promise<void> {
  const storageDirectory = context.environment.storageDirectory;

  await context.ui.withinProgressDialog(title, {}, async (update, abortSignal) => {
    try {
      if (abortSignal.aborted) return;
      update("Resolving API key", 5);
      const apiKey = await resolveApiKey(storageDirectory);
      const client = createClient(apiKey);
      await run(client, update, abortSignal);
    } catch (err) {
      if (abortSignal.aborted) return;
      const message = formatApiError(err);
      update(`Error: ${message}`, 100);
      console.warn(`[elevenlabs-ableton] ${title} failed:`, message);
      await showError(context, message);
    }
  });
}

async function activePronunciationLocators(
  context: ExtensionContext,
): Promise<PronunciationLocator[] | undefined> {
  const config = await loadStorageConfig(context.environment.storageDirectory);
  const active = getActivePronunciationDictionary(config);
  if (!active) return undefined;
  return [{ pronunciationDictionaryId: active.id, versionId: active.versionId }];
}

async function generateSfxVariantsInProgress(
  context: ExtensionContext,
  title: string,
  modal: SfxModalResult,
): Promise<Uint8Array[] | null> {
  let generated: Uint8Array[] | null = null;
  await withElevenLabsProgress(context, title, async (client, update, signal) => {
    if (signal.aborted) return;
    generated = await generateAllSfxVariantsWithProgress(client, modal, update, signal);
  });
  return generated;
}

async function generateAllSfxVariantsWithProgress(
  client: ElevenLabsClient,
  modal: SfxModalResult,
  update: (text: string, progress?: number) => void,
  signal: AbortSignal,
): Promise<Uint8Array[] | null> {
  const count = clampSfxVariants(modal.variants);

  if (count === 1) {
    update("Generating sound effect", 45);
    const bytes = await generateSfx(client, sfxRequestFromModal(modal));
    if (bytes.byteLength < 200) {
      throw new Error("Generated audio is empty or too small to import into Live.");
    }
    return [bytes];
  }

  const variants = await generateAllSfxVariants(client, modal, (index, total) => {
    if (signal.aborted) return;
    update(
      `Generating variant ${index} of ${total}`,
      15 + Math.round(((index - 1) / total) * 55),
    );
  });

  if (signal.aborted) return null;
  return variants;
}

async function generateAllMusicVariants(
  client: ElevenLabsClient,
  modal: MusicModalResult,
  composedPrompt: string,
  update: (text: string, progress?: number) => void,
  signal: AbortSignal,
): Promise<Uint8Array[] | null> {
  const count = clampMusicVariants(modal.variants);
  const request = musicRequestFromModal(modal, composedPrompt);

  if (count === 1) {
    update("Composing music", 45);
    const bytes = await generateMusic(client, request);
    if (bytes.byteLength < 200) {
      throw new Error("Generated audio is empty or too small to import into Live.");
    }
    return [bytes];
  }

  const variants = await generateMusicVariants(client, request, count, (index, total) => {
    if (signal.aborted) return;
    update(
      `Generating variant ${index} of ${total}`,
      15 + Math.round(((index - 1) / total) * 55),
    );
  });

  if (signal.aborted) return null;
  return variants;
}

function drumRackStartNote(modal: DrumRackSfxModalResult): number {
  const start = modal.startMidiNote ?? DRUM_RACK_START_NOTE;
  return Number.isFinite(start) ? Math.round(start) : DRUM_RACK_START_NOTE;
}

function drumRackSfxRequest(modal: DrumRackSfxModalResult, text: string) {
  return {
    text,
    durationSeconds: modal.durationSeconds,
    autoDuration: modal.autoDuration,
    promptInfluence: modal.promptInfluence,
    negativePrompt: modal.negativePrompt,
    outputFormat: parseAudioOutputFormat(modal.outputFormat),
    loop: modal.loop,
    modelId: modal.modelId,
  };
}

async function loadSfxToDrumPad(
  context: ExtensionContext,
  drumRack: DrumRack<"1.0.0">,
  midiNote: number,
  bytes: Uint8Array,
  filename: string,
): Promise<void> {
  const simpler = await ensureSimplerOnPad(context, drumRack, midiNote);
  await importBytesToSimpler(context, bytes, filename, simpler);
}

async function generateDrumRackVariants(
  context: ExtensionContext,
  client: ElevenLabsClient,
  modal: DrumRackSfxModalResult,
  update: (text: string, progress?: number) => void,
  signal: AbortSignal,
  pickIfMultiple: boolean,
): Promise<Uint8Array[] | null> {
  const count = clampSfxVariants(modal.variants);
  const request = drumRackSfxRequest(modal, modal.text!);

  if (count === 1) {
    update("Generating sound effect", 45);
    const bytes = await generateSfx(client, request);
    if (bytes.byteLength < 200) {
      throw new Error("Generated audio is empty or too small to import into Live.");
    }
    return [bytes];
  }

  const variants = await generateSfxVariants(client, request, count, (index, total) => {
    if (signal.aborted) return;
    update(
      `Generating variant ${index} of ${total}`,
      15 + Math.round(((index - 1) / total) * 55),
    );
  });

  if (signal.aborted) return null;

  if (!pickIfMultiple) {
    return variants;
  }

  update("Choose a variant", 78);
  const picked = await promptSfxVariantPick(context, variants);
  return picked ? [picked] : null;
}

async function pipelineDrumRackMultiPad(
  context: ExtensionContext,
  drumRack: DrumRack<"1.0.0">,
  modal: DrumRackSfxModalResult,
): Promise<void> {
  const startNote = drumRackStartNote(modal);
  const count = clampSfxVariants(modal.variants);
  assertPadRange(startNote, count);

  await withElevenLabsProgress(context, "ElevenLabs Drum Rack SFX", async (client, update, signal) => {
    const variants = await generateDrumRackVariants(context, client, modal, update, signal, false);
    if (!variants || signal.aborted) return;

    for (let i = 0; i < variants.length; i++) {
      if (signal.aborted) return;
      const midiNote = startNote + i;
      update(`Loading pad MIDI ${midiNote} (C0+${i})`, 70 + Math.round((i / variants.length) * 25));
      await loadSfxToDrumPad(
        context,
        drumRack,
        midiNote,
        variants[i]!,
        importFilename(`elevenlabs-drum-${midiNote}`, parseAudioOutputFormat(modal.outputFormat)),
      );
    }
    update("Done", 100);
  });
}

async function pipelineDrumRackKit(
  context: ExtensionContext,
  drumRack: DrumRack<"1.0.0">,
  modal: DrumRackSfxModalResult,
): Promise<void> {
  const startNote = drumRackStartNote(modal);
  assertPadRange(startNote, DRUM_KIT_PIECES.length);

  await withElevenLabsProgress(context, "ElevenLabs Drum Kit", async (client, update, signal) => {
    for (let i = 0; i < DRUM_KIT_PIECES.length; i++) {
      if (signal.aborted) return;
      const piece = DRUM_KIT_PIECES[i]!;
      const midiNote = drumKitMidiNote(i, startNote);
      update(`Generating ${piece.label}`, 10 + Math.round((i / DRUM_KIT_PIECES.length) * 70));
      const bytes = await generateSfx(
        client,
        drumRackSfxRequest(modal, buildDrumKitPiecePrompt(modal.text, piece)),
      );
      if (bytes.byteLength < 200) {
        throw new Error(`${piece.label} generation failed — audio too small.`);
      }
      if (signal.aborted) return;
      update(`Loading ${piece.label} → MIDI ${midiNote}`, 75 + Math.round((i / DRUM_KIT_PIECES.length) * 20));
      await loadSfxToDrumPad(
        context,
        drumRack,
        midiNote,
        bytes,
        importFilename(`elevenlabs-kit-${piece.id}`, parseAudioOutputFormat(modal.outputFormat)),
      );
    }
    update("Done", 100);
  });
}

export async function importGeneratedAudio(
  context: ExtensionContext,
  bytes: Uint8Array,
  filename: string,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
  applyPostFx = false,
): Promise<void> {
  if (bytes.byteLength < 200) {
    throw new Error("Generated audio is empty or too small to import into Live.");
  }

  const tempPath = await writeTempAudio(requireTempDirectory(context), bytes, filename);

  if (isClipSlot(target) && target.clip) {
    await target.deleteClip();
  }

  try {
    const tx = context.withinTransaction(() =>
      importAndCreateClip(context, tempPath, clipArgs, target),
    );
    await tx;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to import generated audio into Live (${filename}): ${detail}`);
  }

  if (applyPostFx && target instanceof AudioTrack) {
    await applyVocalPostFx(target);
  }
}

export async function pipelineTts(
  context: ExtensionContext,
  modal: TextVoiceModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
  applyPostFx = false,
): Promise<void> {
  const pronunciationDictionaryLocators = await activePronunciationLocators(context);

  await withElevenLabsProgress(context, "ElevenLabs Text-to-Speech", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating speech", 40);
    const bytes = await generateTts(client, {
      text: modal.text!,
      voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
      pronunciationDictionaryLocators,
      speed: modal.speed,
      stability: modal.stability,
      similarityBoost: modal.similarityBoost,
      style: modal.style,
    });
    if (signal.aborted) return;
    update("Importing into Live", 85);
    await importGeneratedAudio(context, bytes, "elevenlabs-tts.mp3", target, clipArgs, applyPostFx);
    update("Done", 100);
  });
}

export type SfxImportMode = "session" | "arrangement";

export async function pipelineSfx(
  context: ExtensionContext,
  modal: SfxModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
  mode: SfxImportMode = "session",
): Promise<void> {
  const sfxFormat = parseAudioOutputFormat(modal.outputFormat);
  const generated = await generateSfxVariantsInProgress(context, "ElevenLabs SFX", modal);
  if (!generated?.length) return;

  let imports = generated;
  if (mode === "arrangement" && generated.length > 1) {
    const picked = await promptSfxVariantPick(context, generated);
    if (!picked) return;
    imports = [picked];
  }

  const importClipArgs: ImportClipArgs = { ...clipArgs, looping: modal.loop };

  await withElevenLabsProgress(context, "ElevenLabs SFX", async (_client, update, signal) => {
    if (signal.aborted) return;

    if (mode === "session") {
      if (!isClipSlot(target)) {
        throw new Error("Session SFX import requires a clip slot target.");
      }
      const slots = consecutiveClipSlotsFrom(target, imports.length);
      for (let i = 0; i < imports.length; i++) {
        if (signal.aborted) return;
        update(
          imports.length === 1 ? "Importing into Live" : `Loading variant ${i + 1} of ${imports.length}`,
          70 + Math.round((i / imports.length) * 28),
        );
        await importGeneratedAudio(
          context,
          imports[i]!,
          imports.length === 1
            ? importFilename("elevenlabs-sfx", sfxFormat)
            : importFilename(`elevenlabs-sfx-${i + 1}`, sfxFormat),
          slots[i]!,
          importClipArgs,
        );
      }
    } else {
      update("Importing into Live", 85);
      await importGeneratedAudio(
        context,
        imports[0]!,
        importFilename("elevenlabs-sfx", sfxFormat),
        target,
        importClipArgs,
      );
    }
    update("Done", 100);
  });
}

export type MusicImportMode = "session" | "arrangement";

export async function pipelineMusic(
  context: ExtensionContext,
  modal: MusicModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0">,
  clipArgs: ImportClipArgs,
  mode: MusicImportMode = "session",
): Promise<void> {
  const composedPrompt = buildMusicPrompt(modal);
  const musicFormat = parseAudioOutputFormat(modal.outputFormat);
  // Generated length comes from the API — don't clip to arrangement selection width.
  const importArgs: ImportClipArgs = {
    startTime: clipArgs.startTime,
    isWarped: clipArgs.isWarped,
  };

  if (modal.tempoBpm !== undefined && modal.tempoBpm >= 40 && modal.tempoBpm <= 200) {
    context.application.song.tempo = Math.round(modal.tempoBpm);
  }

  await withElevenLabsProgress(context, "ElevenLabs Music", async (client, update, signal) => {
    if (signal.aborted) return;
    const variants = await generateAllMusicVariants(client, modal, composedPrompt, update, signal);
    if (!variants?.length || signal.aborted) return;

    const importClipArgs: ImportClipArgs = { ...importArgs, looping: modal.loop };

    if (mode === "session") {
      if (!isClipSlot(target)) {
        throw new Error("Session music import requires a clip slot target.");
      }
      const slots = consecutiveClipSlotsFrom(target, variants.length);
      for (let i = 0; i < variants.length; i++) {
        if (signal.aborted) return;
        update(
          `Loading variant ${i + 1} of ${variants.length}`,
          70 + Math.round((i / variants.length) * 28),
        );
        await importGeneratedAudio(
          context,
          variants[i]!,
          variants.length === 1
            ? importFilename("elevenlabs-music", musicFormat)
            : importFilename(`elevenlabs-music-${i + 1}`, musicFormat),
          slots[i]!,
          importClipArgs,
        );
      }
    } else {
      if (variants.length > 1) {
        update("Choose a variant", 78);
        const picked = await promptSfxVariantPick(context, variants);
        if (!picked || signal.aborted) return;
        update("Importing into Live", 85);
        await importGeneratedAudio(
          context,
          picked,
          importFilename("elevenlabs-music", musicFormat),
          target,
          importClipArgs,
        );
      } else {
        update("Importing into Live", 85);
        await importGeneratedAudio(
          context,
          variants[0]!,
          importFilename("elevenlabs-music", musicFormat),
          target,
          importClipArgs,
        );
      }
    }
    update("Done", 100);
  });
}

export async function pipelineSimplerTts(
  context: ExtensionContext,
  simpler: Simpler<"1.0.0">,
  modal: TextVoiceModalResult,
): Promise<void> {
  const pronunciationDictionaryLocators = await activePronunciationLocators(context);

  await withElevenLabsProgress(context, "ElevenLabs Text-to-Speech → Simpler", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating speech", 45);
    const bytes = await generateTts(client, {
      text: modal.text!,
      voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
      pronunciationDictionaryLocators,
      speed: modal.speed,
      stability: modal.stability,
      similarityBoost: modal.similarityBoost,
      style: modal.style,
    });
    if (signal.aborted) return;
    update("Replacing sample", 85);
    await importBytesToSimpler(context, bytes, "elevenlabs-simpler-tts.mp3", simpler);
    update("Done", 100);
  });
}

export async function pipelineSimplerSfx(
  context: ExtensionContext,
  simpler: Simpler<"1.0.0">,
  modal: SfxModalResult,
): Promise<void> {
  const sfxFormat = parseAudioOutputFormat(modal.outputFormat);
  const generated = await generateSfxVariantsInProgress(context, "ElevenLabs SFX → Simpler", modal);
  if (!generated?.length) return;

  let bytes = generated[0]!;
  if (generated.length > 1) {
    const picked = await promptSfxVariantPick(context, generated);
    if (!picked) return;
    bytes = picked;
  }

  await withElevenLabsProgress(context, "ElevenLabs SFX → Simpler", async (_client, update, signal) => {
    if (signal.aborted) return;
    update("Replacing sample", 85);
    await importBytesToSimpler(
      context,
      bytes,
      importFilename("elevenlabs-simpler-sfx", sfxFormat),
      simpler,
    );
    update("Done", 100);
  });
}

export async function pipelineVoiceChanger(
  context: ExtensionContext,
  track: AudioTrack<"1.0.0">,
  startTime: number,
  endTime: number,
  voiceId: string,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Voice Changer", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Exporting audio from Live", 20);
    const wavPath = await context.resources.renderPreFxAudio(track, startTime, endTime);
    if (signal.aborted) return;
    update("Transforming voice", 55);
    const bytes = await convertVoice(client, wavPath, voiceId);
    if (signal.aborted) return;
    update("Creating take lane clip", 85);
    const takeLane = await track.createTakeLane();
    await importGeneratedAudio(context, bytes, "elevenlabs-voice-changed.mp3", takeLane, {
      startTime,
      duration: endTime - startTime,
    });
    update("Done", 100);
  });
}

const VOICE_ISOLATION_FILENAME = "elevenlabs-voice-isolated.mp3";

async function importIsolatedVoiceToTakeLane(
  context: ExtensionContext,
  bytes: Uint8Array,
  track: AudioTrack<"1.0.0">,
  clipArgs: ImportClipArgs,
): Promise<void> {
  const takeLane = await track.createTakeLane();
  await importGeneratedAudio(context, bytes, VOICE_ISOLATION_FILENAME, takeLane, clipArgs);
}

async function importIsolatedVoiceToSlot(
  context: ExtensionContext,
  bytes: Uint8Array,
  slot: ClipSlot<"1.0.0">,
  clipArgs: ImportClipArgs,
): Promise<void> {
  await importGeneratedAudio(context, bytes, VOICE_ISOLATION_FILENAME, slot, clipArgs);
}

export async function pipelineVocalIsolation(
  context: ExtensionContext,
  track: AudioTrack<"1.0.0">,
  startTime: number,
  endTime: number,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Voice Isolation", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Exporting audio from Live", 20);
    const wavPath = await context.resources.renderPreFxAudio(track, startTime, endTime);
    if (signal.aborted) return;
    update("Isolating voice", 55);
    const bytes = await isolateVocals(client, wavPath);
    if (signal.aborted) return;
    update("Creating take lane clip", 85);
    await importIsolatedVoiceToTakeLane(
      context,
      bytes,
      track,
      { startTime, duration: endTime - startTime },
    );
    update("Done", 100);
  });
}

export async function pipelineVocalIsolationClipSlot(
  context: ExtensionContext,
  slot: ClipSlot<"1.0.0">,
): Promise<void> {
  const clip = slot.clip;
  if (!(clip instanceof AudioClip)) return;
  const audioPath = clip.filePath;
  if (!audioPath) return;

  await withElevenLabsProgress(context, "ElevenLabs Voice Isolation", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Isolating voice", 40);
    const bytes = await isolateVocals(client, audioPath);
    if (signal.aborted) return;
    update("Replacing clip", 85);
    await importIsolatedVoiceToSlot(context, bytes, slot, { looping: clip.looping });
    update("Done", 100);
  });
}

export async function pipelineVocalIsolationClip(
  context: ExtensionContext,
  clip: AudioClip<"1.0.0">,
): Promise<void> {
  const audioPath = await resolveAudioPathForClip(clip);
  if (!audioPath) return;

  const parent = clip.parent;
  if (parent && isClipSlot(parent)) {
    await pipelineVocalIsolationClipSlot(context, parent);
    return;
  }

  if (!parent || !isAudioTrack(parent)) return;

  await withElevenLabsProgress(context, "ElevenLabs Voice Isolation", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Isolating voice", 40);
    const bytes = await isolateVocals(client, audioPath);
    if (signal.aborted) return;
    update("Creating take lane clip", 85);
    await importIsolatedVoiceToTakeLane(
      context,
      bytes,
      parent,
      { startTime: clip.startTime, duration: clip.duration },
    );
    update("Done", 100);
  });
}

export async function pipelineTranscribe(
  context: ExtensionContext,
  audioPath: string,
  showTranscriptResult: (transcript: string) => Promise<void>,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Scribe", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Transcribing audio", 50);
    const transcript = await transcribeAudio(client, audioPath);
    if (signal.aborted) return;
    update("Showing transcript", 90);
    await showTranscriptResult(transcript);
    update("Done", 100);
  });
}

export async function pipelineDialogue(
  context: ExtensionContext,
  modal: DialogueModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0">,
  clipArgs: ImportClipArgs,
): Promise<void> {
  const lines = parseDialogueScript(modal.script!, {
    voiceA: modal.voiceA!,
    voiceB: modal.voiceB!,
    voiceC: modal.voiceC!,
  });
  if (!lines.length) {
    await showError(
      context,
      "No dialogue lines found. Prefix each line with 1:, 2:, or 3: for speakers A, B, or C.\n\nExample:\n1: Hello there\n2: Hi, how are you?\n3: [excited] Count me in!",
    );
    return;
  }

  await withElevenLabsProgress(context, "ElevenLabs Dialogue", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating dialogue", 45);
    const bytes = await generateDialogue(client, lines, { stability: modal.stability });
    if (signal.aborted) return;
    update("Importing into Live", 85);
    await importGeneratedAudio(context, bytes, "elevenlabs-dialogue.mp3", target, clipArgs);
    update("Done", 100);
  });
}

export async function pipelineDrumRackSfx(
  context: ExtensionContext,
  drumRack: DrumRack<"1.0.0">,
  modal: DrumRackSfxModalResult,
): Promise<void> {
  if (modal.buildDrumKit) {
    await pipelineDrumRackKit(context, drumRack, modal);
    return;
  }

  if (modal.autoLoadPads) {
    await pipelineDrumRackMultiPad(context, drumRack, modal);
    return;
  }

  const simpler = findSimplerOnPad(drumRack, modal.midiNote!);
  if (!simpler) {
    await showError(context, `No Simpler found on drum pad MIDI note ${modal.midiNote}.`);
    return;
  }

  await withElevenLabsProgress(context, "ElevenLabs Drum Rack SFX", async (client, update, signal) => {
    const variants = await generateDrumRackVariants(context, client, modal, update, signal, true);
    if (!variants?.length || signal.aborted) return;
    update("Replacing sample", 85);
    await importBytesToSimpler(
      context,
      variants[0]!,
      importFilename("elevenlabs-drum-rack-sfx", parseAudioOutputFormat(modal.outputFormat)),
      simpler,
    );
    update("Done", 100);
  });
}

async function createLyricMidiClip(
  context: ExtensionContext,
  clipStartBeat: number,
  clipDurationBeats: number,
  notes: ReturnType<typeof wordsToLyricNotes>,
  clipName: string,
): Promise<void> {
  if (!notes.length) {
    throw new Error("No timed words returned — cannot create MIDI lyric markers.");
  }

  const song = context.application.song;
  const tx = context.withinTransaction(() =>
    song.createMidiTrack().then(async (midiTrack) => {
      midiTrack.name = "ElevenLabs Lyrics";
      const midiClip = await midiTrack.createMidiClip(clipStartBeat, clipDurationBeats);
      midiClip.name = clipName;
      midiClip.notes = notes;
    }),
  );
  await tx;
}

export async function pipelineTranscribeToMidi(
  context: ExtensionContext,
  audioPath: string,
  clipStartBeat: number,
  clipDurationBeats: number,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs → MIDI Lyrics", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Transcribing with word timestamps", 40);
    const { words } = await transcribeWithWords(client, audioPath);
    if (signal.aborted) return;

    const tempo = context.application.song.tempo;
    const notes = wordsToLyricNotes(words, tempo, clipStartBeat);

    update("Creating MIDI clip", 80);
    await createLyricMidiClip(context, clipStartBeat, clipDurationBeats, notes, "Lyrics (Scribe)");
    update("Done", 100);
  });
}

export async function pipelineAlignToMidi(
  context: ExtensionContext,
  audioPath: string,
  modal: AlignLyricsModalResult,
  clipStartBeat: number,
  clipDurationBeats: number,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Forced Alignment", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Aligning lyrics to audio", 45);
    const words = await forceAlignAudio(client, audioPath, modal.transcript!);
    if (signal.aborted) return;

    const tempo = context.application.song.tempo;
    const notes = alignedWordsToLyricNotes(words, tempo, clipStartBeat);

    update("Creating MIDI clip", 80);
    await createLyricMidiClip(context, clipStartBeat, clipDurationBeats, notes, "Lyrics (Aligned)");
    update("Done", 100);
  });
}

export async function pipelineCloneVoice(
  context: ExtensionContext,
  audioPath: string,
  modal: CloneVoiceModalResult,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Voice Clone", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Cloning voice from audio", 50);
    const voiceId = await cloneVoiceFromAudio(client, audioPath, modal.name!);
    if (signal.aborted) return;

    update("Saving voice reference", 85);
    await addClonedVoice(context.environment.storageDirectory, {
      voiceId,
      name: modal.name!,
      createdAt: Date.now(),
    });
    invalidateVoiceCache();

    update("Done", 100);
    await showResult(
      context,
      "Voice cloned",
      `Name: ${modal.name}\nVoice ID: ${voiceId}\n\nSaved to storage. Use this ID in text-to-speech or voice changer.`,
    );
  });
}

export async function pipelinePronunciationRule(
  context: ExtensionContext,
  modal: PronunciationModalResult,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Pronunciation", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Creating pronunciation dictionary", 50);
    const locator = await createPronunciationRule(
      client,
      modal.dictionaryName!,
      modal.stringToReplace!,
      modal.alias!,
    );
    if (signal.aborted) return;

    update("Saving to storage", 85);
    await addPronunciationDictionary(
      context.environment.storageDirectory,
      {
        id: locator.pronunciationDictionaryId,
        versionId: locator.versionId,
        name: modal.dictionaryName!,
        createdAt: Date.now(),
      },
      modal.setActive ?? true,
    );

    update("Done", 100);
    await showResult(
      context,
      "Pronunciation rule saved",
      `Dictionary: ${modal.dictionaryName}\n"${modal.stringToReplace}" → "${modal.alias}"\n\n${
        modal.setActive ? "Active for subsequent text-to-speech." : "Not set as active."
      }`,
    );
  });
}

export async function pipelineStemSeparation(
  context: ExtensionContext,
  audioPath: string,
  modal: StemSeparationModalResult,
  clipStartBeat: number,
  clipDurationBeats: number,
): Promise<void> {
  const variation = (modal.stemVariationId ?? "six_stems_v1") as StemVariationId;

  await withElevenLabsProgress(context, "ElevenLabs Stem Separation", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Separating stems (may take a while)", 30);
    const zipBytes = await separateMusicStems(client, audioPath, variation);
    if (signal.aborted) return;

    const entries = extractZipArchive(zipBytes);
    if (!entries.length) {
      throw new Error("Stem separation returned an empty archive.");
    }

    update(`Importing ${entries.length} stems`, 70);
    const song = context.application.song;
    const tempDirectory = requireTempDirectory(context);

    const tx = context.withinTransaction(() =>
      Promise.all(
        entries.map(async (entry, index) => {
          const label = stemLabelFromFilename(entry.name);
          const track = await song.createAudioTrack();
          track.name = `Stem: ${label}`;
          await setTrackVolume(track, stemVolumeLevel(entry.name));

          const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const tempPath = await writeTempAudio(tempDirectory, entry.data, `stem-${index}-${safeName}`);
          await importAndCreateClip(context, tempPath, {
            startTime: clipStartBeat,
            duration: clipDurationBeats,
          }, track);
        }),
      ),
    );
    await tx;
    update("Done", 100);
  });
}

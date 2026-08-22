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
  DEFAULT_MODEL_ID,
  ELEVEN_V3_MODEL_ID,
  forceAlignAudio,
  generateDialogue,
  generateMusicWithMetadata,
  composeInpaintingMusic,
  generateSfx,
  generateTts,
  isolateVocals,
  separateMusicStems,
  transcribeAudio,
  transcribeWithWords,
  type PronunciationLocator,
  type StemVariationId,
  type TranscribedWord,
} from "./elevenlabs-client.js";
import { parseDialogueScript, validateDialogueInput } from "./dialogue.js";
import { ensureSimplerOnPad, isDrumPadOccupied } from "./drum-io.js";
import {
  assertEnabledDrumPadsMidiRange,
  defaultDurationForType,
  DRUM_RACK_START_NOTE,
  drumPadMidiNote,
  drumTypeById,
  noteName,
  resolveDrumPadPrompt,
} from "./drum-kit.js";
import type { ExtensionContext } from "./live-selection.js";
import { isAudioTrack, isClipSlot } from "./sdk-objects.js";
import { applyVocalPostFx, setTrackVolume } from "./live-io.js";
import { alignedWordsToLyricNotes, secondsToBeats, wordsToLyricNotes } from "./midi-io.js";
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
  MusicInpaintModalResult,
  MusicInpaintMode,
  PronunciationModalResult,
  SfxModalResult,
  StemSeparationModalResult,
  TextVoiceModalResult,
} from "./types.js";
import { parseAudioOutputFormat, parseMusicOutputFormat, importFilename } from "./audio-output-formats.js";
import {
  buildExtendPlan,
  buildRegenerateSectionPlan,
  buildSeamlessLoopPlan,
  buildSimilarPlan,
  stylesFromPrompt,
} from "./music-inpainting.js";
import { resolveSongIdForAudio } from "./music-song-resolver.js";
import { addStoredSong } from "./storage.js";
import { buildMusicPrompt, musicForceInstrumental } from "./music-prompt.js";
import { consecutiveClipSlotsFrom } from "./clip-io.js";
import {
  clampMusicVariants,
  musicRequestFromModal,
} from "./music-variants.js";
import {
  clampSfxVariants,
  generateAllSfxVariants,
  generateSfxVariants,
  sfxRequestFromModal,
} from "./sfx-variants.js";
import { formatApiError } from "./api-errors.js";
import { promptSfxVariantPick, resolveApiKeyWithPrompt, showError, showResult } from "./ui.js";

export async function withElevenLabsProgress(
  context: ExtensionContext,
  title: string,
  run: (
    client: ElevenLabsClient,
    update: (text: string, progress?: number) => void,
    abortSignal: AbortSignal,
  ) => Promise<void>,
): Promise<void> {
  const apiKey = await resolveApiKeyWithPrompt(context);
  if (!apiKey) return;

  await context.ui.withinProgressDialog(title, {}, async (update, abortSignal) => {
    try {
      if (abortSignal.aborted) return;
      update("Connecting to ElevenLabs", 5);
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
): Promise<Array<{ bytes: Uint8Array; songId?: string; words?: TranscribedWord[] }> | null> {
  const count = clampMusicVariants(modal.variants);
  const request = { ...musicRequestFromModal(modal, composedPrompt), storeForInpainting: true };
  const variants: Array<{ bytes: Uint8Array; songId?: string; words?: TranscribedWord[] }> = [];

  for (let i = 0; i < count; i++) {
    if (signal.aborted) return null;
    update(count === 1 ? "Composing music" : `Generating variant ${i + 1} of ${count}`, 15 + Math.round((i / count) * 55));
    const result = await generateMusicWithMetadata(client, request);
    if (result.bytes.byteLength < 200) {
      throw new Error(`Variant ${i + 1} is empty or too small to use.`);
    }
    variants.push({ bytes: result.bytes, songId: result.songId, words: result.words });
  }

  return variants;
}

function musicClipDurationBeats(
  modal: MusicModalResult,
  words: TranscribedWord[] | undefined,
  clipArgs: ImportClipArgs,
  tempo: number,
): number {
  if (clipArgs.duration !== undefined) return clipArgs.duration;
  if (!modal.autoDuration && modal.musicLengthMs) {
    return secondsToBeats(modal.musicLengthMs / 1000, tempo);
  }
  const lastEnd = words?.reduce((max, word) => Math.max(max, word.end ?? 0), 0) ?? 0;
  return secondsToBeats(Math.max(lastEnd, 10), tempo);
}

async function maybeCreateMusicLyricMarkers(
  context: ExtensionContext,
  modal: MusicModalResult,
  words: TranscribedWord[] | undefined,
  clipArgs: ImportClipArgs,
): Promise<void> {
  if (musicForceInstrumental(modal) || !words?.length) return;

  const tempo = context.application.song.tempo;
  const clipStartBeat = clipArgs.startTime ?? 0;
  const notes = wordsToLyricNotes(words, tempo, clipStartBeat);
  if (!notes.length) return;

  const clipDurationBeats = musicClipDurationBeats(modal, words, clipArgs, tempo);
  await createLyricMidiClip(context, clipStartBeat, clipDurationBeats, notes, "Lyrics (Music)");
}

function drumRackStartNote(modal: DrumRackSfxModalResult): number {
  const start = modal.startMidiNote ?? DRUM_RACK_START_NOTE;
  return Number.isFinite(start) ? Math.round(start) : DRUM_RACK_START_NOTE;
}

function drumRackSfxRequest(
  modal: DrumRackSfxModalResult,
  text: string,
  overrides?: { durationSeconds?: number; autoDuration?: boolean },
) {
  return {
    text,
    durationSeconds: overrides?.durationSeconds,
    autoDuration: overrides?.autoDuration ?? true,
    promptInfluence: modal.promptInfluence,
    outputFormat: parseAudioOutputFormat(modal.outputFormat),
    loop: false,
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

export async function importGeneratedAudio(
  context: ExtensionContext,
  bytes: Uint8Array,
  filename: string,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
  applyPostFx = false,
): Promise<string> {
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
    const importedPath = await tx;
    if (applyPostFx && target instanceof AudioTrack) {
      await applyVocalPostFx(target);
    }
    return importedPath;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to import generated audio into Live (${filename}): ${detail}`);
  }
}

export async function pipelineTts(
  context: ExtensionContext,
  modal: TextVoiceModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
  applyPostFx = false,
): Promise<void> {
  const useV3 = modal.modelId === ELEVEN_V3_MODEL_ID;
  const pronunciationDictionaryLocators = useV3
    ? undefined
    : await activePronunciationLocators(context);

  await withElevenLabsProgress(context, "ElevenLabs Text-to-Speech", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating speech", 40);
    const bytes = await generateTts(client, {
      text: modal.text!,
      voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
      modelId: modal.modelId ?? DEFAULT_MODEL_ID,
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
  const composedPrompt = buildMusicPrompt(modal, {
    rootNote: context.application.song.rootNote,
    scaleName: context.application.song.scaleName,
  });
  const musicFormat = parseMusicOutputFormat(modal.outputFormat);
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
        const importedPath = await importGeneratedAudio(
          context,
          variants[i]!.bytes,
          variants.length === 1
            ? importFilename("elevenlabs-music", musicFormat)
            : importFilename(`elevenlabs-music-${i + 1}`, musicFormat),
          slots[i]!,
          importClipArgs,
        );
        if (variants[i]!.songId) {
          await addStoredSong(context.environment.storageDirectory, {
            songId: variants[i]!.songId!,
            filePath: importedPath,
            prompt: composedPrompt,
            durationMs: modal.musicLengthMs,
            createdAt: Date.now(),
          });
        }
        await maybeCreateMusicLyricMarkers(context, modal, variants[i]!.words, {
          ...importClipArgs,
          startTime: 0,
        });
      }
    } else {
      if (variants.length > 1) {
        update("Choose a variant", 78);
        const picked = await promptSfxVariantPick(context, variants.map((v) => v.bytes));
        if (!picked || signal.aborted) return;
        update("Importing into Live", 85);
        const importedPath = await importGeneratedAudio(
          context,
          picked,
          importFilename("elevenlabs-music", musicFormat),
          target,
          importClipArgs,
        );
        const pickedIndex = variants.findIndex((v) => v.bytes === picked);
        const meta = variants[pickedIndex >= 0 ? pickedIndex : 0];
        if (meta?.songId) {
          await addStoredSong(context.environment.storageDirectory, {
            songId: meta.songId,
            filePath: importedPath,
            prompt: composedPrompt,
            durationMs: modal.musicLengthMs,
            createdAt: Date.now(),
          });
        }
        await maybeCreateMusicLyricMarkers(context, modal, meta?.words, importClipArgs);
      } else {
        update("Importing into Live", 85);
        const importedPath = await importGeneratedAudio(
          context,
          variants[0]!.bytes,
          importFilename("elevenlabs-music", musicFormat),
          target,
          importClipArgs,
        );
        if (variants[0]!.songId) {
          await addStoredSong(context.environment.storageDirectory, {
            songId: variants[0]!.songId!,
            filePath: importedPath,
            prompt: composedPrompt,
            durationMs: modal.musicLengthMs,
            createdAt: Date.now(),
          });
        }
        await maybeCreateMusicLyricMarkers(context, modal, variants[0]!.words, importClipArgs);
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
  const useV3 = modal.modelId === ELEVEN_V3_MODEL_ID;
  const pronunciationDictionaryLocators = useV3
    ? undefined
    : await activePronunciationLocators(context);

  await withElevenLabsProgress(context, "ElevenLabs Text-to-Speech → Simpler", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating speech", 45);
    const bytes = await generateTts(client, {
      text: modal.text!,
      voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
      modelId: modal.modelId ?? DEFAULT_MODEL_ID,
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
  const voices = {
    voiceA: modal.voiceA!,
    voiceB: modal.voiceB!,
    voiceC: modal.voiceC,
  };
  const validationError = validateDialogueInput(modal.script!, voices);
  if (validationError) {
    await showError(context, validationError);
    return;
  }

  const lines = parseDialogueScript(modal.script!, voices);
  if (!lines.length) {
    await showError(
      context,
      "No dialogue lines could be parsed. Check that each line uses A:, B:, or C: prefixes.",
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
  const startNote = drumRackStartNote(modal);
  const mappingMode = modal.padMappingMode === "gm" ? "gm" : "sequential";
  const enabledPads = (modal.pads ?? []).filter((p) => p.enabled);
  if (!enabledPads.length) {
    await showError(context, "No drum pads are enabled.");
    return;
  }

  assertEnabledDrumPadsMidiRange(enabledPads, startNote, mappingMode);

  await withElevenLabsProgress(context, "ElevenLabs Drum Rack SFX", async (client, update, signal) => {
    const skipped: string[] = [];
    let loaded = 0;
    const total = enabledPads.length;
    let step = 0;

    for (const pad of enabledPads) {
      if (signal.aborted) return;

      const drumType = drumTypeById(pad.type);
      const label = drumType?.label ?? pad.type;
      const midiNote = drumPadMidiNote(pad.padIndex, startNote, mappingMode, pad.type);

      if (!modal.overwriteOccupied && isDrumPadOccupied(drumRack, midiNote)) {
        skipped.push(`${label} (${noteName(midiNote)})`);
        update(
          `Skipping ${label} (${noteName(midiNote)}) — pad has a sample`,
          10 + Math.round((step / total) * 70),
        );
        step++;
        continue;
      }

      update(`Generating ${label}`, 10 + Math.round((step / total) * 70));
      const pitchKey =
        pad.type === "kick" ? modal.kickKey : pad.type === "snare" ? modal.snareKey : undefined;
      const text = resolveDrumPadPrompt(
        pad.stylePhrase,
        pad.characteristics,
        pad.type,
        pitchKey,
      );
      const autoDuration = pad.autoDuration !== false;
      const bytes = await generateSfx(
        client,
        drumRackSfxRequest(modal, text, {
          durationSeconds: autoDuration
            ? undefined
            : pad.durationSeconds ?? defaultDurationForType(pad.type),
          autoDuration,
        }),
      );
      if (bytes.byteLength < 200) {
        throw new Error(`${label} generation failed — audio too small.`);
      }
      if (signal.aborted) return;

      update(
        `Loading ${label} → ${noteName(midiNote)} (${midiNote})`,
        75 + Math.round((step / total) * 20),
      );
      await loadSfxToDrumPad(
        context,
        drumRack,
        midiNote,
        bytes,
        importFilename(`elevenlabs-drum-${pad.type}-${midiNote}`, parseAudioOutputFormat(modal.outputFormat)),
      );
      loaded++;
      step++;
    }

    update("Done", 100);

    if (skipped.length) {
      const skipList = skipped.join(", ");
      if (loaded === 0) {
        await showResult(
          context,
          "Drum Rack SFX complete",
          `No pads were loaded — all target pads already had samples (${skipList}). Enable "Overwrite pads" to replace them.`,
        );
      } else {
        await showResult(
          context,
          "Drum Rack SFX complete",
          `Loaded ${loaded} pad(s). Skipped ${skipped.length} (already had samples): ${skipList}. Re-run with "Overwrite pads" to replace them.`,
        );
      }
    }
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

function buildInpaintPlan(
  mode: MusicInpaintMode,
  songId: string,
  totalDurationMs: number,
  modal: MusicInpaintModalResult,
): ReturnType<typeof buildExtendPlan> {
  const styles = stylesFromPrompt(modal.styles ?? "electronic music, instrumental");
  const sec = (n: number | undefined, fallback: number) => Math.round((n ?? fallback) * 1000);

  switch (mode) {
    case "extend":
      return buildExtendPlan(
        songId,
        Math.round(totalDurationMs * 0.2),
        Math.round(totalDurationMs * 0.8),
        sec(modal.introSec, 15),
        sec(modal.outroSec, 15),
        styles,
      );
    case "regenerate": {
      const start = sec(modal.regenStartSec, totalDurationMs / 2000);
      const end = sec(modal.regenEndSec, totalDurationMs / 1000);
      return buildRegenerateSectionPlan(
        songId,
        totalDurationMs,
        start,
        end,
        modal.regenText ?? "[Section]\n{regenerated section}",
        styles,
      );
    }
    case "loop": {
      const sliceStart = sec(modal.sliceStartSec, totalDurationMs / 1000 * 0.3);
      const sliceEnd = sec(modal.sliceEndSec, totalDurationMs / 1000 * 0.7);
      return buildSeamlessLoopPlan(songId, sliceStart, sliceEnd, sec(modal.glueSec, 3), styles);
    }
    case "similar":
      return buildSimilarPlan(
        songId,
        0,
        Math.min(10_000, totalDurationMs),
        modal.prompt ?? "[Verse]\nNew song inspired by reference",
        sec(modal.durationSec, 30) / 2,
        "[Chorus]\nContinuation",
        sec(modal.durationSec, 30) / 2,
        styles,
      );
  }
}

export async function pipelineMusicInpaint(
  context: ExtensionContext,
  mode: MusicInpaintMode,
  audioPath: string,
  totalDurationMs: number,
  modal: MusicInpaintModalResult,
  target: AudioTrack<"1.0.0">,
  clipArgs: ImportClipArgs,
): Promise<void> {
  const musicFormat = parseMusicOutputFormat(undefined);

  await withElevenLabsProgress(context, "ElevenLabs Music Inpaint", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Resolving song reference", 20);
    const songId = await resolveSongIdForAudio(client, context, audioPath, {
      durationMs: totalDurationMs,
    });
    if (signal.aborted) return;

    update("Building inpainting plan", 35);
    let activeSongId = songId;
    update("Generating music", 55);
    let result;
    try {
      result = await composeInpaintingMusic(client, buildInpaintPlan(mode, activeSongId, totalDurationMs, modal), {
        outputFormat: musicFormat,
        storeForInpainting: true,
      });
    } catch (err) {
      const message = formatApiError(err).toLowerCase();
      const songReferenceFailed =
        message.includes("song") &&
        (message.includes("not found") || message.includes("expired") || message.includes("invalid"));
      if (!songReferenceFailed) throw err;
      if (signal.aborted) return;
      update("Song reference expired — re-uploading audio", 45);
      activeSongId = await resolveSongIdForAudio(client, context, audioPath, {
        durationMs: totalDurationMs,
        retryUpload: true,
      });
      update("Generating music", 55);
      result = await composeInpaintingMusic(
        client,
        buildInpaintPlan(mode, activeSongId, totalDurationMs, modal),
        { outputFormat: musicFormat, storeForInpainting: true },
      );
    }
    if (signal.aborted) return;

    update("Importing into Live", 85);
    const importedPath = await importGeneratedAudio(
      context,
      result.bytes,
      importFilename(`elevenlabs-music-${mode}`, musicFormat),
      target,
      { ...clipArgs, looping: mode === "loop" },
    );
    if (result.songId) {
      await addStoredSong(context.environment.storageDirectory, {
        songId: result.songId,
        filePath: importedPath,
        prompt: modal.styles,
        durationMs: totalDurationMs,
        createdAt: Date.now(),
      });
    }
    update("Done", 100);
  });
}

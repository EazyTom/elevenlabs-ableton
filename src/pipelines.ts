import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
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
import { findSimplerOnPad } from "./drum-io.js";
import type { ExtensionContext } from "./live-selection.js";
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
import { formatApiError } from "./api-errors.js";
import { showError, showResult } from "./ui.js";

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

export async function importGeneratedAudio(
  context: ExtensionContext,
  bytes: Uint8Array,
  filename: string,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
  applyPostFx = false,
): Promise<void> {
  const tempPath = await writeTempAudio(requireTempDirectory(context), bytes, filename);
  const tx = context.withinTransaction(() =>
    importAndCreateClip(context, tempPath, clipArgs, target),
  );
  await tx;

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

  await withElevenLabsProgress(context, "ElevenLabs TTS", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating speech", 40);
    const bytes = await generateTts(client, {
      text: modal.text!,
      voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
      pronunciationDictionaryLocators,
    });
    if (signal.aborted) return;
    update("Importing into Live", 85);
    await importGeneratedAudio(context, bytes, "elevenlabs-tts.mp3", target, clipArgs, applyPostFx);
    update("Done", 100);
  });
}

export async function pipelineSfx(
  context: ExtensionContext,
  modal: SfxModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
  clipArgs: ImportClipArgs,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs SFX", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating sound effect", 45);
    const bytes = await generateSfx(client, {
      text: modal.text!,
      durationSeconds: modal.durationSeconds,
      promptInfluence: modal.promptInfluence,
    });
    if (signal.aborted) return;
    update("Importing into Live", 85);
    await importGeneratedAudio(context, bytes, "elevenlabs-sfx.mp3", target, clipArgs);
    update("Done", 100);
  });
}

export async function pipelineMusic(
  context: ExtensionContext,
  modal: MusicModalResult,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0">,
  clipArgs: ImportClipArgs,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Music", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Composing music", 45);
    const bytes = await generateMusic(client, {
      prompt: modal.prompt!,
      musicLengthMs: modal.musicLengthMs,
      forceInstrumental: modal.forceInstrumental,
    });
    if (signal.aborted) return;
    update("Importing into Live", 85);
    await importGeneratedAudio(context, bytes, "elevenlabs-music.mp3", target, clipArgs);
    update("Done", 100);
  });
}

export async function pipelineSimplerTts(
  context: ExtensionContext,
  simpler: Simpler<"1.0.0">,
  modal: TextVoiceModalResult,
): Promise<void> {
  const pronunciationDictionaryLocators = await activePronunciationLocators(context);

  await withElevenLabsProgress(context, "ElevenLabs TTS → Simpler", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating speech", 45);
    const bytes = await generateTts(client, {
      text: modal.text!,
      voiceId: modal.voiceId ?? DEFAULT_VOICE_ID,
      pronunciationDictionaryLocators,
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
  await withElevenLabsProgress(context, "ElevenLabs SFX → Simpler", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating sound effect", 45);
    const bytes = await generateSfx(client, {
      text: modal.text!,
      durationSeconds: modal.durationSeconds,
      promptInfluence: modal.promptInfluence,
    });
    if (signal.aborted) return;
    update("Replacing sample", 85);
    await importBytesToSimpler(context, bytes, "elevenlabs-simpler-sfx.mp3", simpler);
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

export async function pipelineVocalIsolation(
  context: ExtensionContext,
  track: AudioTrack<"1.0.0">,
  startTime: number,
  endTime: number,
): Promise<void> {
  await withElevenLabsProgress(context, "ElevenLabs Vocal Isolation", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Exporting audio from Live", 20);
    const wavPath = await context.resources.renderPreFxAudio(track, startTime, endTime);
    if (signal.aborted) return;
    update("Isolating vocals", 55);
    const bytes = await isolateVocals(client, wavPath);
    if (signal.aborted) return;
    update("Creating take lane clip", 85);
    const takeLane = await track.createTakeLane();
    await importGeneratedAudio(context, bytes, "elevenlabs-vocals.mp3", takeLane, {
      startTime,
      duration: endTime - startTime,
    });
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
  const lines = parseDialogueScript(modal.script!, modal.voiceA!, modal.voiceB!);
  if (!lines.length) {
    await showError(
      context,
      "No dialogue lines found. Prefix each line with 1: (speaker A) or 2: (speaker B).\n\nExample:\n1: Hello there\n2: Hi, how are you?",
    );
    return;
  }

  await withElevenLabsProgress(context, "ElevenLabs Dialogue", async (client, update, signal) => {
    if (signal.aborted) return;
    update("Generating dialogue", 45);
    const bytes = await generateDialogue(client, lines);
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
  const simpler = findSimplerOnPad(drumRack, modal.midiNote!);
  if (!simpler) {
    await showError(context, `No Simpler found on drum pad MIDI note ${modal.midiNote}.`);
    return;
  }

  await pipelineSimplerSfx(context, simpler, {
    text: modal.text,
    durationSeconds: modal.durationSeconds,
    promptInfluence: modal.promptInfluence,
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
      `Name: ${modal.name}\nVoice ID: ${voiceId}\n\nSaved to storage. Use this ID in TTS or voice changer.`,
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
        modal.setActive ? "Active for subsequent TTS." : "Not set as active."
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

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { createReadStream } from "fs";
import { readFile } from "fs/promises";
import path from "path";

import { postJsonBinary, postMultipart, readAudioUpload } from "./multipart-upload.js";

const CLIENT_API_KEY = Symbol.for("elevenlabs-ableton.apiKey");

export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
export const DEFAULT_MODEL_ID = "eleven_flash_v2_5";
export const STS_MODEL_ID = "eleven_multilingual_sts_v2";
export const STT_MODEL_ID = "scribe_v2";

export interface PronunciationLocator {
  pronunciationDictionaryId: string;
  versionId: string;
}

export interface TtsRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  pronunciationDictionaryLocators?: PronunciationLocator[];
  speed?: number;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

/** ElevenLabs default voice settings (matches web app defaults). */
export const DEFAULT_TTS_SPEED = 1;
export const DEFAULT_TTS_STABILITY = 0.5;
export const DEFAULT_TTS_SIMILARITY = 0.75;
export const DEFAULT_TTS_STYLE = 0;

function buildTtsVoiceSettings(request: TtsRequest) {
  const { speed, stability, similarityBoost, style } = request;
  if (
    speed === undefined &&
    stability === undefined &&
    similarityBoost === undefined &&
    style === undefined
  ) {
    return undefined;
  }
  return {
    ...(speed !== undefined && { speed }),
    ...(stability !== undefined && { stability }),
    ...(similarityBoost !== undefined && { similarityBoost }),
    ...(style !== undefined && { style }),
  };
}

export const SFX_MODEL_V1 = "eleven_text_to_sound_v1";
export const SFX_MODEL_V2 = "eleven_text_to_sound_v2";
export type SfxModelId = typeof SFX_MODEL_V1 | typeof SFX_MODEL_V2;
export const DEFAULT_SFX_MODEL: SfxModelId = SFX_MODEL_V2;

export interface SfxRequest {
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
  modelId?: SfxModelId;
}

export const MUSIC_MODEL_V1 = "music_v1";
export const MUSIC_MODEL_V2 = "music_v2";
export type MusicModelId = typeof MUSIC_MODEL_V1 | typeof MUSIC_MODEL_V2;
export const DEFAULT_MUSIC_MODEL: MusicModelId = MUSIC_MODEL_V1;

export interface MusicRequest {
  prompt: string;
  musicLengthMs?: number;
  forceInstrumental?: boolean;
  modelId?: MusicModelId;
  loop?: boolean;
}

export interface VoiceSummary {
  voiceId: string;
  name: string;
}

export interface DialogueLine {
  text: string;
  voiceId: string;
}

export interface TranscribedWord {
  text: string;
  start?: number;
  end?: number;
  type: string;
}

export interface AlignedWord {
  text: string;
  start: number;
  end: number;
}

export type StemVariationId = "two_stems_v1" | "six_stems_v1";

async function readApiKeyFromDir(dir: string): Promise<string | undefined> {
  try {
    const key = (await readFile(path.join(dir, "api-key.txt"), "utf-8")).trim();
    return key || undefined;
  } catch {
    return undefined;
  }
}

export async function resolveApiKey(storageDirectory: string | undefined): Promise<string> {
  if (process.env.ELEVENLABS_API_KEY?.trim()) {
    return process.env.ELEVENLABS_API_KEY.trim();
  }

  const searchDirs = [
    storageDirectory,
    process.env.ELEVENLABS_STORAGE_DIRECTORY?.trim(),
  ].filter((d): d is string => Boolean(d));

  for (const dir of searchDirs) {
    const key = await readApiKeyFromDir(dir);
    if (key) return key;
  }

  throw new Error(
    "ElevenLabs API key not found. Set ELEVENLABS_API_KEY, ELEVENLABS_STORAGE_DIRECTORY in .env, or pass --storage-directory with api-key.txt.",
  );
}

export function createClient(apiKey: string): ElevenLabsClient {
  const client = new ElevenLabsClient({ apiKey });
  (client as ElevenLabsClient & { [CLIENT_API_KEY]?: string })[CLIENT_API_KEY] = apiKey;
  return client;
}

function clientApiKey(client: ElevenLabsClient): string {
  const key = (client as ElevenLabsClient & { [CLIENT_API_KEY]?: string })[CLIENT_API_KEY];
  if (!key) {
    throw new Error("ElevenLabs client is missing its API key.");
  }
  return key;
}

/** Read a Web ReadableStream without relying on the Response global (unavailable in Live's Extension Host). */
export async function streamToBytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }

  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export async function generateTts(client: ElevenLabsClient, request: TtsRequest): Promise<Uint8Array> {
  const stream = await client.textToSpeech.convert(request.voiceId ?? DEFAULT_VOICE_ID, {
    text: request.text,
    modelId: request.modelId ?? DEFAULT_MODEL_ID,
    outputFormat: "mp3_44100_128",
    voiceSettings: buildTtsVoiceSettings(request),
    pronunciationDictionaryLocators: request.pronunciationDictionaryLocators?.map((loc) => ({
      pronunciationDictionaryId: loc.pronunciationDictionaryId,
      versionId: loc.versionId,
    })),
  });
  return streamToBytes(stream);
}

export async function generateSfx(client: ElevenLabsClient, request: SfxRequest): Promise<Uint8Array> {
  const modelId =
    request.loop ? SFX_MODEL_V2 : (request.modelId ?? DEFAULT_SFX_MODEL);
  const stream = await client.textToSoundEffects.convert({
    text: request.text,
    durationSeconds: request.durationSeconds,
    promptInfluence: request.promptInfluence ?? 0.3,
    loop: request.loop ?? false,
    modelId,
    outputFormat: "mp3_44100_128",
  });
  return streamToBytes(stream);
}

export async function generateMusic(client: ElevenLabsClient, request: MusicRequest): Promise<Uint8Array> {
  const body: Record<string, unknown> = {
    prompt: request.prompt,
    music_length_ms: request.musicLengthMs ?? 30_000,
    force_instrumental: request.forceInstrumental ?? false,
    model_id: request.modelId ?? DEFAULT_MUSIC_MODEL,
    generation_mode: request.loop ? "loop" : "track",
  };
  return postJsonBinary(clientApiKey(client), "/v1/music", body, {
    output_format: "mp3_44100_128",
  });
}

export async function convertVoice(
  client: ElevenLabsClient,
  audioPath: string,
  voiceId: string,
): Promise<Uint8Array> {
  const stream = await client.speechToSpeech.convert(voiceId, {
    audio: createReadStream(audioPath),
    modelId: STS_MODEL_ID,
    outputFormat: "mp3_44100_128",
  });
  return streamToBytes(stream);
}

export async function isolateVocals(client: ElevenLabsClient, audioPath: string): Promise<Uint8Array> {
  const stream = await client.audioIsolation.convert({
    audio: createReadStream(audioPath),
  });
  return streamToBytes(stream);
}

export async function listVoices(
  client: ElevenLabsClient,
  search?: string,
): Promise<VoiceSummary[]> {
  const response = await client.voices.search({
    pageSize: 50,
    search: search || undefined,
  });

  return response.voices.map((v) => ({
    voiceId: v.voiceId,
    name: v.name ?? v.voiceId,
  }));
}

export async function generateDialogue(
  client: ElevenLabsClient,
  lines: DialogueLine[],
): Promise<Uint8Array> {
  const stream = await client.textToDialogue.convert({
    inputs: lines.map((line) => ({ text: line.text, voiceId: line.voiceId })),
    outputFormat: "mp3_44100_128",
  });
  return streamToBytes(stream);
}

export async function transcribeAudio(
  client: ElevenLabsClient,
  audioPath: string,
): Promise<string> {
  const { text } = await transcribeWithWords(client, audioPath);
  return text;
}

export async function transcribeWithWords(
  client: ElevenLabsClient,
  audioPath: string,
): Promise<{ text: string; words: TranscribedWord[] }> {
  const response = await client.speechToText.convert({
    modelId: STT_MODEL_ID,
    file: createReadStream(audioPath),
    diarize: false,
    tagAudioEvents: true,
  });

  if ("words" in response && Array.isArray(response.words)) {
    const words: TranscribedWord[] = response.words.map((w) => ({
      text: w.text,
      start: w.start,
      end: w.end,
      type: w.type,
    }));
    const text =
      typeof response.text === "string"
        ? response.text
        : words.map((w) => w.text).join(" ");
    return { text, words };
  }

  if ("transcripts" in response && Array.isArray(response.transcripts)) {
    const first = response.transcripts[0];
    if (first && "words" in first && Array.isArray(first.words)) {
      const words: TranscribedWord[] = first.words.map((w: { text: string; start?: number; end?: number; type: string }) => ({
        text: w.text,
        start: w.start,
        end: w.end,
        type: w.type,
      }));
      const text = typeof first.text === "string" ? first.text : words.map((w) => w.text).join(" ");
      return { text, words };
    }
  }

  if ("text" in response && typeof response.text === "string") {
    return { text: response.text, words: [] };
  }

  throw new Error("Unexpected speech-to-text response format.");
}

export async function separateMusicStems(
  client: ElevenLabsClient,
  audioPath: string,
  stemVariationId: StemVariationId = "six_stems_v1",
): Promise<Uint8Array> {
  const upload = await readAudioUpload(audioPath);

  // Live's Extension Host uses formdata-polyfill when native FormData is missing;
  // fetch + that polyfill drops file parts (422 "Field required"). Manual multipart works.
  return postMultipart(clientApiKey(client), "/v1/music/stem-separation", {
    query: { output_format: "mp3_44100_128" },
    fields: [{ name: "stem_variation_id", value: stemVariationId }],
    files: [{
      name: "file",
      filename: upload.filename,
      contentType: upload.contentType,
      data: upload.data,
    }],
  });
}

export async function cloneVoiceFromAudio(
  client: ElevenLabsClient,
  audioPath: string,
  name: string,
): Promise<string> {
  const response = await client.voices.ivc.create({
    name,
    files: [createReadStream(audioPath)],
    removeBackgroundNoise: true,
  });
  return response.voiceId;
}

export async function forceAlignAudio(
  client: ElevenLabsClient,
  audioPath: string,
  transcript: string,
): Promise<AlignedWord[]> {
  const response = await client.forcedAlignment.create({
    file: createReadStream(audioPath),
    text: transcript,
  });

  return response.words.map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
  }));
}

export async function createPronunciationRule(
  client: ElevenLabsClient,
  name: string,
  stringToReplace: string,
  alias: string,
): Promise<PronunciationLocator> {
  const response = await client.pronunciationDictionaries.createFromRules({
    name,
    rules: [
      {
        type: "alias",
        stringToReplace,
        alias,
        caseSensitive: false,
        wordBoundaries: true,
      },
    ],
  });

  return {
    pronunciationDictionaryId: response.id,
    versionId: response.versionId,
  };
}

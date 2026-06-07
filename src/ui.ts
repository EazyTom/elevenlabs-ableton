import type { initialize } from "@ableton-extensions/sdk";

import alignLyricsModalHtml from "../ui/align-lyrics-modal.html";
import cloneVoiceModalHtml from "../ui/clone-voice-modal.html";
import dialogueModalHtml from "../ui/dialogue-modal.html";
import drumRackSfxModalHtml from "../ui/drum-rack-sfx-modal.html";
import musicModalHtml from "../ui/music-modal.html";
import pronunciationModalHtml from "../ui/pronunciation-modal.html";
import resultModalHtml from "../ui/result-modal.html";
import sfxModalHtml from "../ui/sfx-modal.html";
import stemSeparationModalHtml from "../ui/stem-separation-modal.html";
import transcriptModalHtml from "../ui/transcript-modal.html";
import ttsModalHtml from "../ui/tts-modal.html";
import voiceModalHtml from "../ui/voice-modal.html";
import {
  createClient,
  listVoices,
  resolveApiKey,
  type VoiceSummary,
} from "./elevenlabs-client.js";
import { MODAL_HEADER_EXTRA_HEIGHT, prepareModalHtml } from "./ui-branding.js";
import { getCachedVoices, setCachedVoices } from "./voice-cache.js";
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
  VoiceOnlyModalResult,
} from "./types.js";

type ExtensionContext = ReturnType<typeof initialize>;

function modalUrl(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

function parseJson<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildVoiceOptionsHtml(voices: VoiceSummary[]): string {
  const defaultOpt = '<option value="">— Default voice —</option>';
  const opts = voices
    .map(
      (v) =>
        `<option value="${escapeHtml(v.voiceId)}">${escapeHtml(v.name)} (${escapeHtml(v.voiceId.slice(0, 8))}…)</option>`,
    )
    .join("");
  return defaultOpt + opts;
}

async function fetchVoices(context: ExtensionContext): Promise<VoiceSummary[]> {
  const cached = getCachedVoices();
  if (cached) return cached;

  const apiKey = await resolveApiKey(context.environment.storageDirectory);
  const client = createClient(apiKey);
  try {
    const voices = await listVoices(client);
    setCachedVoices(voices);
    return voices;
  } catch (err) {
    console.warn("[elevenlabs-ableton] Voice list unavailable, using manual ID entry.", err);
    return [];
  }
}

function injectVoiceOptions(template: string, voices: VoiceSummary[]): string {
  const options = buildVoiceOptionsHtml(voices);
  return template.replace(/\{\{VOICE_OPTIONS\}\}/g, options);
}

async function showModal<T>(
  context: ExtensionContext,
  html: string,
  w: number,
  h: number,
  subtitle?: string,
): Promise<T> {
  const raw = await context.ui.showModalDialog(
    modalUrl(prepareModalHtml(html, subtitle)),
    w,
    h + MODAL_HEADER_EXTRA_HEIGHT,
  );
  return parseJson<T>(raw);
}

export async function promptTts(context: ExtensionContext): Promise<TextVoiceModalResult | null> {
  const voices = await fetchVoices(context);
  const parsed = await showModal<TextVoiceModalResult>(
    context,
    injectVoiceOptions(ttsModalHtml, voices),
    420,
    360,
    "Text to speech",
  );
  if (parsed.cancelled || !parsed.text?.trim()) return null;
  return parsed;
}

export async function promptSfx(context: ExtensionContext): Promise<SfxModalResult | null> {
  const parsed = await showModal<SfxModalResult>(context, sfxModalHtml, 420, 320, "Sound effects");
  if (parsed.cancelled || !parsed.text?.trim()) return null;
  return parsed;
}

export async function promptMusic(context: ExtensionContext): Promise<MusicModalResult | null> {
  const parsed = await showModal<MusicModalResult>(context, musicModalHtml, 440, 340, "Music generation");
  if (parsed.cancelled || !parsed.prompt?.trim()) return null;
  return parsed;
}

export async function promptVoice(context: ExtensionContext): Promise<VoiceOnlyModalResult | null> {
  const voices = await fetchVoices(context);
  const parsed = await showModal<VoiceOnlyModalResult>(
    context,
    injectVoiceOptions(voiceModalHtml, voices),
    400,
    260,
    "Voice selection",
  );
  if (parsed.cancelled || !parsed.voiceId?.trim()) return null;
  return parsed;
}

export async function promptDialogue(context: ExtensionContext): Promise<DialogueModalResult | null> {
  const voices = await fetchVoices(context);
  const options = buildVoiceOptionsHtml(voices);
  const html = dialogueModalHtml
    .replace("{{VOICE_OPTIONS_A}}", options)
    .replace("{{VOICE_OPTIONS_B}}", options);
  const parsed = await showModal<DialogueModalResult>(context, html, 460, 400, "Text to dialogue");
  if (parsed.cancelled || !parsed.script?.trim() || !parsed.voiceA || !parsed.voiceB) return null;
  return parsed;
}

export async function promptDrumRackSfx(
  context: ExtensionContext,
): Promise<DrumRackSfxModalResult | null> {
  const parsed = await showModal<DrumRackSfxModalResult>(
    context,
    drumRackSfxModalHtml,
    420,
    360,
    "Drum rack SFX",
  );
  if (parsed.cancelled || !parsed.text?.trim() || parsed.midiNote === undefined) return null;
  return parsed;
}

export async function promptCloneVoice(context: ExtensionContext): Promise<CloneVoiceModalResult | null> {
  const parsed = await showModal<CloneVoiceModalResult>(
    context,
    cloneVoiceModalHtml,
    400,
    220,
    "Clone voice",
  );
  if (parsed.cancelled || !parsed.name?.trim()) return null;
  return parsed;
}

export async function promptAlignLyrics(context: ExtensionContext): Promise<AlignLyricsModalResult | null> {
  const parsed = await showModal<AlignLyricsModalResult>(
    context,
    alignLyricsModalHtml,
    440,
    360,
    "Align lyrics",
  );
  if (parsed.cancelled || !parsed.transcript?.trim()) return null;
  return parsed;
}

export async function promptPronunciationRule(
  context: ExtensionContext,
): Promise<PronunciationModalResult | null> {
  const parsed = await showModal<PronunciationModalResult>(
    context,
    pronunciationModalHtml,
    420,
    380,
    "Pronunciation rule",
  );
  if (parsed.cancelled || !parsed.dictionaryName?.trim() || !parsed.stringToReplace?.trim() || !parsed.alias?.trim()) {
    return null;
  }
  return parsed;
}

export async function promptStemSeparation(
  context: ExtensionContext,
): Promise<StemSeparationModalResult | null> {
  const parsed = await showModal<StemSeparationModalResult>(
    context,
    stemSeparationModalHtml,
    400,
    240,
    "Stem separation",
  );
  if (parsed.cancelled) return null;
  return parsed;
}

export async function showTranscript(context: ExtensionContext, transcript: string): Promise<void> {
  const escaped = escapeHtml(transcript);
  const html = transcriptModalHtml.replace("{{TRANSCRIPT}}", escaped);
  await context.ui.showModalDialog(
    modalUrl(prepareModalHtml(html, "Transcript")),
    520,
    400 + MODAL_HEADER_EXTRA_HEIGHT,
  );
}

export async function showResult(context: ExtensionContext, title: string, body: string): Promise<void> {
  const html = resultModalHtml
    .replace("{{TITLE}}", escapeHtml(title))
    .replace("{{BODY}}", escapeHtml(body));
  await context.ui.showModalDialog(
    modalUrl(prepareModalHtml(html)),
    460,
    280 + MODAL_HEADER_EXTRA_HEIGHT,
  );
}

export async function showError(context: ExtensionContext, message: string): Promise<void> {
  await showResult(context, "Something went wrong", message);
}

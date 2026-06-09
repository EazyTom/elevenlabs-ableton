import type { initialize } from "@ableton-extensions/sdk";
import { DrumRack } from "@ableton-extensions/sdk";

import alignLyricsModalHtml from "../ui/align-lyrics-modal.html";
import cloneVoiceModalHtml from "../ui/clone-voice-modal.html";
import dialogueModalHtml from "../ui/dialogue-modal.html";
import drumRackSfxModalHtml from "../ui/drum-rack-sfx-modal.html";
import musicModalHtml from "../ui/music-modal.html";
import pronunciationModalHtml from "../ui/pronunciation-modal.html";
import resultModalHtml from "../ui/result-modal.html";
import sfxModalHtml from "../ui/sfx-modal.html";
import sfxVariantPickerModalHtml from "../ui/sfx-variant-picker-modal.html";
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
import { listPadsWithSimpler, type DrumPadSummary } from "./drum-io.js";
import { DRUM_RACK_START_NOTE } from "./drum-kit.js";
import { parseAudioOutputFormat } from "./audio-output-formats.js";
import { clampMusicLengthMs } from "./music-length.js";
import { buildMusicPromptRandomizerScript, musicForceInstrumental } from "./music-prompt.js";
import { clampMusicVariants } from "./music-variants.js";
import { buildSfxPromptRandomizerScript } from "./sfx-prompt.js";
import { clampSfxVariants } from "./sfx-variants.js";
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
  SfxVariantPickerResult,
  StemSeparationModalResult,
  TextVoiceModalResult,
  VoiceOnlyModalResult,
} from "./types.js";

type ExtensionContext = ReturnType<typeof initialize>;

function modalUrl(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}

function parseJson<T>(raw: string): T {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return { cancelled: true } as T;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    console.warn("[elevenlabs-ableton] Modal returned invalid JSON; treating as cancelled.");
    return { cancelled: true } as T;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPadOptionsHtml(pads: DrumPadSummary[]): string {
  if (pads.length === 0) {
    return '<option value="">No Simpler pads — add a Simpler to a pad first</option>';
  }
  const opts = pads
    .map((p) => `<option value="${p.midiNote}">MIDI note ${p.midiNote}</option>`)
    .join("");
  return `<option value="">Select pad…</option>${opts}`;
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

function prepareSfxModalHtml(template: string): string {
  return template.replace(/\{\{SFX_PROMPT_RANDOMIZER\}\}/g, buildSfxPromptRandomizerScript());
}

function clampLiveTempoForSlider(tempo: number): number {
  if (!Number.isFinite(tempo)) return 120;
  return Math.min(200, Math.max(40, Math.round(tempo)));
}

function prepareMusicModalHtml(template: string, liveTempo: number): string {
  const tempo = clampLiveTempoForSlider(liveTempo);
  return template
    .replace(/\{\{MUSIC_PROMPT_RANDOMIZER\}\}/g, buildMusicPromptRandomizerScript())
    .replace(/\{\{LIVE_TEMPO\}\}/g, String(tempo));
}

function normalizeMusicModalResult(parsed: MusicModalResult): MusicModalResult {
  const negativePrompt = parsed.negativePrompt?.trim();
  const autoDuration = parsed.autoDuration ?? false;
  const musicLengthMs = autoDuration
    ? undefined
    : clampMusicLengthMs(parsed.musicLengthMs);
  return {
    ...parsed,
    autoDuration,
    musicLengthMs,
    forceInstrumental: musicForceInstrumental(parsed),
    variants: clampMusicVariants(parsed.variants),
    modelId: parsed.modelId === "music_v1" ? "music_v1" : "music_v2",
    outputFormat: parseAudioOutputFormat(parsed.outputFormat),
    promptInfluence: parsed.promptInfluence ?? 0.3,
    negativePrompt: negativePrompt || undefined,
  };
}

function normalizeSfxModalResult(parsed: SfxModalResult): SfxModalResult {
  const autoDuration = parsed.autoDuration ?? true;
  return {
    ...parsed,
    autoDuration,
    durationSeconds: autoDuration ? undefined : parsed.durationSeconds,
    variants: clampSfxVariants(parsed.variants),
    modelId: parsed.modelId === "eleven_text_to_sound_v1" ? "eleven_text_to_sound_v1" : "eleven_text_to_sound_v2",
    outputFormat: parseAudioOutputFormat(parsed.outputFormat),
    promptInfluence: parsed.promptInfluence ?? 0.3,
  };
}

function normalizeDrumRackSfxModalResult(parsed: DrumRackSfxModalResult): DrumRackSfxModalResult {
  return {
    ...normalizeSfxModalResult(parsed),
    startMidiNote: parsed.startMidiNote ?? DRUM_RACK_START_NOTE,
  };
}

function buildSfxVariantOptionsHtml(variants: Uint8Array[]): string {
  return variants
    .map((bytes, i) => {
      const kb = (bytes.byteLength / 1024).toFixed(1);
      const checked = i === 0 ? " checked" : "";
      return `<label class="checkbox"><input type="radio" name="variant" value="${i}"${checked} /> Variant ${i + 1} (${kb} KB)</label>`;
    })
    .join("\n");
}

/** After multi-variant generation, let the user pick which bytes to import. */
export async function promptSfxVariantPick(
  context: ExtensionContext,
  variants: Uint8Array[],
): Promise<Uint8Array | null> {
  if (variants.length === 0) return null;
  if (variants.length === 1) return variants[0]!;

  const html = sfxVariantPickerModalHtml.replace(
    /\{\{VARIANT_OPTIONS\}\}/g,
    buildSfxVariantOptionsHtml(variants),
  );
  const parsed = await showModal<SfxVariantPickerResult>(
    context,
    html,
    380,
    140 + variants.length * 26,
    "Pick variant",
  );
  if (parsed.cancelled || parsed.variantIndex === undefined) return null;
  const idx = parsed.variantIndex;
  if (!Number.isFinite(idx) || idx < 0 || idx >= variants.length) return null;
  return variants[idx]!;
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
    520,
    "Text-to-Speech",
  );
  if (parsed.cancelled || !parsed.text?.trim()) return null;
  return parsed;
}

export async function promptSfx(context: ExtensionContext): Promise<SfxModalResult | null> {
  const parsed = await showModal<SfxModalResult>(
    context,
    prepareSfxModalHtml(sfxModalHtml),
    420,
    640,
    "Generate Sound Effects",
  );
  if (parsed.cancelled || !parsed.text?.trim()) return null;
  return normalizeSfxModalResult(parsed);
}

export async function promptMusic(context: ExtensionContext): Promise<MusicModalResult | null> {
  const liveTempo = context.application.song.tempo;
  const parsed = await showModal<MusicModalResult>(
    context,
    prepareMusicModalHtml(musicModalHtml, liveTempo),
    460,
    780,
    "Generate Music",
  );
  if (parsed.cancelled || (!parsed.prompt?.trim() && !(parsed.genres?.length))) return null;
  return normalizeMusicModalResult(parsed);
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
    .replace("{{VOICE_OPTIONS_B}}", options)
    .replace("{{VOICE_OPTIONS_C}}", options);
  const parsed = await showModal<DialogueModalResult>(context, html, 480, 520, "Text to dialogue");
  if (
    parsed.cancelled ||
    !parsed.script?.trim() ||
    !parsed.voiceA ||
    !parsed.voiceB ||
    !parsed.voiceC
  ) {
    return null;
  }
  return parsed;
}

export async function promptDrumRackSfx(
  context: ExtensionContext,
  drumRack: DrumRack<"1.0.0">,
): Promise<DrumRackSfxModalResult | null> {
  const pads = listPadsWithSimpler(drumRack);
  const html = prepareSfxModalHtml(
    drumRackSfxModalHtml.replace(/\{\{PAD_OPTIONS\}\}/g, buildPadOptionsHtml(pads)),
  );
  const parsed = await showModal<DrumRackSfxModalResult>(
    context,
    html,
    440,
    760,
    "Drum rack SFX",
  );
  if (parsed.cancelled) return null;

  const variants = clampSfxVariants(parsed.variants);
  const startMidiNote = parsed.startMidiNote ?? DRUM_RACK_START_NOTE;

  if (parsed.buildDrumKit) {
    return normalizeDrumRackSfxModalResult({
      ...parsed,
      variants: 1,
      autoLoadPads: false,
      buildDrumKit: true,
      startMidiNote,
    });
  }

  if (parsed.autoLoadPads) {
    if (!parsed.text?.trim()) return null;
    return normalizeDrumRackSfxModalResult({
      ...parsed,
      variants,
      autoLoadPads: true,
      buildDrumKit: false,
      startMidiNote,
    });
  }

  if (!parsed.text?.trim()) return null;
  const midiNote = parsed.midiNote;
  if (midiNote === undefined || !Number.isFinite(midiNote) || midiNote < 0 || midiNote > 127) {
    return null;
  }
  return normalizeDrumRackSfxModalResult({
    ...parsed,
    variants,
    midiNote,
    autoLoadPads: false,
    buildDrumKit: false,
    startMidiNote,
  });
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

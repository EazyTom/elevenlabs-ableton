import type { initialize } from "@ableton-extensions/sdk";
import { DrumRack } from "@ableton-extensions/sdk";

import apiKeyModalHtml from "../ui/api-key-modal.html";
import alignLyricsModalHtml from "../ui/align-lyrics-modal.html";
import cloneVoiceModalHtml from "../ui/clone-voice-modal.html";
import dialogueModalHtml from "../ui/dialogue-modal.html";
import drumRackSfxModalHtml from "../ui/drum-rack-sfx-modal.html";
import musicInpaintModalHtml from "../ui/music-inpaint-modal.html";
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
  apiKeyFilePath,
  clearApiKeyFile,
  hasStoredApiKeyFile,
  readApiKeyFromStorageFile,
  saveApiKeyToStorage,
  tryResolveApiKey,
  validateApiKey,
} from "./api-key.js";
import {
  createClient,
  listVoices,
  type VoiceSummary,
} from "./elevenlabs-client.js";
import { validateDialogueInput } from "./dialogue.js";
import {
  buildDrumPadRandomizerScript,
  clampPadDurationSeconds,
  DEFAULT_KIT_TYPE_BY_PAD,
  defaultCharacteristicsForType,
  defaultDurationForType,
  DRUM_PAD_SLOT_COUNT,
  DRUM_RACK_START_NOTE,
  DRUM_KIT_START_NOTE_OPTIONS,
  DRUM_TYPES,
  DRUM_PITCH_KEY_OPTIONS,
} from "./drum-kit.js";
import { parseAudioOutputFormat } from "./audio-output-formats.js";
import { SFX_MODEL_V2 } from "./elevenlabs-client.js";
import { clampMusicLengthMs } from "./music-length.js";
import { buildMusicPromptRandomizerScript, musicForceInstrumental } from "./music-prompt.js";
import { clampMusicVariants } from "./music-variants.js";
import { buildSfxPromptRandomizerScript } from "./sfx-prompt.js";
import { clampSfxVariants } from "./sfx-variants.js";
import { MODAL_HEADER_EXTRA_HEIGHT, prepareModalHtml } from "./ui-branding.js";
import { getCachedVoices, setCachedVoices } from "./voice-cache.js";
import {
  getDrumKitSettings,
  saveDrumKitSettings,
  type StoredDrumKitSettings,
} from "./storage.js";
import type {
  AlignLyricsModalResult,
  ApiKeyModalResult,
  CloneVoiceModalResult,
  DialogueModalResult,
  DrumPadConfig,
  DrumRackSfxModalResult,
  MusicInpaintModalResult,
  MusicInpaintMode,
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

function buildDrumTypeOptionsHtml(selectedType: string): string {
  return DRUM_TYPES.map((t) => {
    const sel = t.id === selectedType ? " selected" : "";
    return `<option value="${t.id}"${sel}>${escapeHtml(t.label)}</option>`;
  }).join("");
}

function buildDrumPadRowsHtml(persisted: StoredDrumKitSettings | undefined): string {
  const rows: string[] = [];
  for (let i = 0; i < DRUM_PAD_SLOT_COUNT; i++) {
    const saved = persisted?.pads.find((p) => p.padIndex === i);
    const type = saved?.type ?? DEFAULT_KIT_TYPE_BY_PAD[i] ?? "kick";
    const phrase = escapeHtml(saved?.stylePhrase ?? "");
    const characteristics = escapeHtml(defaultCharacteristicsForType(type));
    const duration = clampPadDurationSeconds(saved?.durationSeconds, defaultDurationForType(type));
    const sliderValue = Math.round(duration * 2);
    const autoDuration = saved?.autoDuration !== false;
    const autoChecked = autoDuration ? " checked" : "";
    const enabled = i === 0;
    const checked = enabled ? " checked" : "";
    const durationLabel = autoDuration ? "Auto" : `${duration.toFixed(1)} sec`;
    rows.push(`<div class="pad-row" id="padRow_${i}">
  <div class="pad-row-header">
    <label class="checkbox pad-enable"><input id="padEnabled_${i}" type="checkbox"${checked} /> Enable</label>
    <span id="padLabel_${i}" class="pad-label">Drum Pad ${i + 1}</span>
    <select id="padType_${i}" class="pad-type">${buildDrumTypeOptionsHtml(type)}</select>
    <button type="button" class="pad-randomize" onclick="randomizePadPhrase(${i})">Randomize</button>
  </div>
  <input id="padPhrase_${i}" class="pad-phrase" type="text" value="${phrase}" placeholder="Style or mood phrase" />
  <textarea id="padCharacteristics_${i}" class="pad-characteristics" rows="2" placeholder="Sound character only — timing and level rules are added automatically">${characteristics}</textarea>
  <label class="tempo-row pad-duration-row">
    <span class="control-label">Duration</span>
    <span id="padDurationValue_${i}" class="slider-value">${durationLabel}</span>
    <input id="padDuration_${i}" type="range" min="1" max="60" step="1" value="${sliderValue}" />
    <label class="checkbox pad-auto-inline"><input id="padAutoDuration_${i}" type="checkbox"${autoChecked} /> Auto</label>
  </label>
</div>`);
  }
  return rows.join("\n");
}

function buildStartNoteOptionsHtml(selected = DRUM_RACK_START_NOTE): string {
  return DRUM_KIT_START_NOTE_OPTIONS.map((opt) => {
    const sel = opt.midiNote === selected ? " selected" : "";
    return `<option value="${opt.midiNote}"${sel}>${opt.label} (${opt.midiNote})</option>`;
  }).join("");
}

function buildPadMappingModeOptionsHtml(selected: "sequential" | "gm" = "sequential"): string {
  const options: Array<{ value: "sequential" | "gm"; label: string }> = [
    { value: "sequential", label: "Sequential" },
    { value: "gm", label: "General MIDI" },
  ];
  return options
    .map((opt) => {
      const sel = opt.value === selected ? " selected" : "";
      return `<option value="${opt.value}"${sel}>${opt.label}</option>`;
    })
    .join("");
}

function buildPitchKeyOptionsHtml(selected = ""): string {
  return DRUM_PITCH_KEY_OPTIONS.map((key) => {
    const label = key ? key : "None";
    const sel = key === selected ? " selected" : "";
    return `<option value="${key}"${sel}>${label}</option>`;
  }).join("");
}

function prepareDrumRackSfxModalHtml(
  template: string,
  persisted: StoredDrumKitSettings | undefined,
): string {
  const selectedStart = persisted?.startMidiNote ?? DRUM_RACK_START_NOTE;
  const mappingMode = persisted?.padMappingMode === "gm" ? "gm" : "sequential";
  return template
    .replace(/\{\{DRUM_PAD_RANDOMIZER\}\}/g, buildDrumPadRandomizerScript())
    .replace(/\{\{DRUM_PAD_ROWS\}\}/g, buildDrumPadRowsHtml(persisted))
    .replace(/\{\{START_NOTE_OPTIONS\}\}/g, buildStartNoteOptionsHtml(selectedStart))
    .replace(/\{\{PAD_MAPPING_MODE_OPTIONS\}\}/g, buildPadMappingModeOptionsHtml(mappingMode))
    .replace(/\{\{KICK_KEY_OPTIONS\}\}/g, buildPitchKeyOptionsHtml(persisted?.kickKey ?? ""))
    .replace(/\{\{SNARE_KEY_OPTIONS\}\}/g, buildPitchKeyOptionsHtml(persisted?.snareKey ?? ""))
    .replace(/\{\{OVERWRITE_CHECKED\}\}/g, persisted?.overwriteOccupied ? " checked" : "");
}

function normalizeDrumPads(parsed: DrumRackSfxModalResult): DrumPadConfig[] {
  const pads = parsed.pads ?? [];
  return pads.map((pad) => {
    const type = pad.type || DEFAULT_KIT_TYPE_BY_PAD[pad.padIndex] || "kick";
    const autoDuration = pad.autoDuration !== false;
    return {
      ...pad,
      type,
      durationSeconds: clampPadDurationSeconds(pad.durationSeconds, defaultDurationForType(type)),
      characteristics: pad.characteristics?.trim() || defaultCharacteristicsForType(type),
      enabled: pad.enabled === true,
      autoDuration,
    };
  });
}

function normalizeDrumRackSfxModalResult(parsed: DrumRackSfxModalResult): DrumRackSfxModalResult {
  const kickKey = parsed.kickKey?.trim();
  const snareKey = parsed.snareKey?.trim();
  return {
    ...parsed,
    startMidiNote: parsed.startMidiNote ?? DRUM_RACK_START_NOTE,
    padMappingMode: parsed.padMappingMode === "gm" ? "gm" : "sequential",
    pads: normalizeDrumPads(parsed),
    overwriteOccupied: parsed.overwriteOccupied ?? false,
    kickKey: kickKey || undefined,
    snareKey: snareKey || undefined,
    modelId: SFX_MODEL_V2,
    outputFormat: parseAudioOutputFormat(parsed.outputFormat),
    promptInfluence: parsed.promptInfluence ?? 0.3,
  };
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

  const apiKey = await resolveApiKeyWithPrompt(context);
  if (!apiKey) return [];

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

function prepareApiKeyModalHtml(
  context: ExtensionContext,
  manageMode: boolean,
  existingKey?: string,
): string {
  const storageDirectory = context.environment.storageDirectory;
  const storagePath = storageDirectory
    ? apiKeyFilePath(storageDirectory)
    : "(storage directory not configured — see README)";
  const envSet = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const envHint = envSet
    ? '<p class="env-hint">ELEVENLABS_API_KEY is set in the environment and takes precedence over the saved file.</p>'
    : "";
  const existingHint = existingKey
    ? '<p class="hint">A key is saved. Use Show to view it, edit to replace, or Remove to delete.</p>'
    : "";
  const clearButton =
    manageMode && storageDirectory && existingKey
      ? '<button type="button" onclick="clearKey()">Remove saved key</button>'
      : "";
  const existingKeyScript = existingKey
    ? `<script>
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("apiKey").value = ${JSON.stringify(existingKey)};
});
</script>`
    : "";
  return apiKeyModalHtml
    .replace(/\{\{STORAGE_PATH\}\}/g, escapeHtml(storagePath))
    .replace(/\{\{ENV_KEY_HINT\}\}/g, envHint)
    .replace(/\{\{EXISTING_KEY_HINT\}\}/g, existingHint)
    .replace(/\{\{CLEAR_BUTTON\}\}/g, clearButton)
    .replace(/\{\{EXISTING_KEY_SCRIPT\}\}/g, existingKeyScript);
}

export async function promptApiKey(
  context: ExtensionContext,
  opts?: { manageMode?: boolean; errorMessage?: string },
): Promise<ApiKeyModalResult | null> {
  const storageDirectory = context.environment.storageDirectory;
  if (!storageDirectory) {
    await showError(
      context,
      "Storage directory is not configured. Launch the extension with --storage-directory (see README).",
    );
    return null;
  }

  let existingKey: string | undefined;
  if (opts?.manageMode) {
    existingKey = await readApiKeyFromStorageFile(storageDirectory);
  }

  let html = prepareApiKeyModalHtml(context, opts?.manageMode ?? false, existingKey);
  if (opts?.errorMessage) {
    html = html.replace(
      '<p id="error" class="error" hidden></p>',
      `<p id="error" class="error">${escapeHtml(opts.errorMessage)}</p>`,
    );
  }

  const parsed = await showModal<ApiKeyModalResult>(context, html, 460, 300, "ElevenLabs API Key");
  if (parsed.cancelled) return null;
  return parsed;
}

export async function resolveApiKeyWithPrompt(context: ExtensionContext): Promise<string | undefined> {
  const storageDirectory = context.environment.storageDirectory;
  const existing = await tryResolveApiKey(storageDirectory);
  if (existing) return existing;

  let errorMessage: string | undefined;

  for (;;) {
    const result = await promptApiKey(context, errorMessage ? { errorMessage } : undefined);
    errorMessage = undefined;
    if (!result) return undefined;
    if (result.clearKey) {
      if (storageDirectory) await clearApiKeyFile(storageDirectory);
      await showResult(context, "API key removed", "The stored api-key.txt file was removed.");
      return undefined;
    }
    const key = result.apiKey?.trim();
    if (!key || !storageDirectory) return undefined;

    const validation = await validateApiKey(key);
    if (validation.ok) {
      await saveApiKeyToStorage(storageDirectory, key);
      return key;
    }
    if (validation.reason === "invalid") {
      errorMessage = "That API key was rejected by ElevenLabs. Check the key and try again.";
      continue;
    }
    await saveApiKeyToStorage(storageDirectory, key);
    await showResult(
      context,
      "API key saved",
      `Could not verify the key online (${validation.message}). It was saved anyway — generation will confirm on first use.`,
    );
    return key;
  }
}

export async function promptManageApiKey(context: ExtensionContext): Promise<void> {
  if (process.env.ELEVENLABS_API_KEY?.trim()) {
    await showResult(
      context,
      "API key",
      "ELEVENLABS_API_KEY is set in the environment and overrides any saved api-key.txt file.",
    );
    return;
  }
  const storageDirectory = context.environment.storageDirectory;
  if (!storageDirectory) {
    await showError(
      context,
      "Storage directory is not configured. Launch the extension with --storage-directory (see README).",
    );
    return;
  }
  const hasFile = await hasStoredApiKeyFile(storageDirectory);
  const existingKey = hasFile ? await readApiKeyFromStorageFile(storageDirectory) : undefined;
  const result = await promptApiKey(context, { manageMode: Boolean(existingKey) });
  if (!result) return;
  if (result.clearKey) {
    await clearApiKeyFile(storageDirectory);
    await showResult(context, "API key removed", "The stored api-key.txt file was removed.");
    return;
  }
  const key = result.apiKey?.trim();
  if (!key) return;
  if (existingKey && key === existingKey) {
    await showResult(context, "API key unchanged", "Your stored API key is still active.");
    return;
  }
  const validation = await validateApiKey(key);
  if (!validation.ok && validation.reason === "invalid") {
    await showError(context, "That API key was rejected by ElevenLabs.");
    return;
  }
  await saveApiKeyToStorage(storageDirectory, key);
  if (!validation.ok && validation.reason === "network") {
    await showResult(
      context,
      "API key saved",
      `Could not verify online (${validation.message}). Key saved to api-key.txt.`,
    );
  } else {
    await showResult(context, "API key saved", `Saved to ${apiKeyFilePath(storageDirectory)}`);
  }
}

function injectVoiceOptions(template: string, voices: VoiceSummary[]): string {
  const options = buildVoiceOptionsHtml(voices);
  return template.replace(/\{\{VOICE_OPTIONS\}\}/g, options);
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
    modelId: SFX_MODEL_V2,
    outputFormat: parseAudioOutputFormat(parsed.outputFormat),
    promptInfluence: parsed.promptInfluence ?? 0.3,
  };
}

function prepareSfxModalHtml(template: string): string {
  return template.replace(/\{\{SFX_PROMPT_RANDOMIZER\}\}/g, buildSfxPromptRandomizerScript());
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

export async function promptMusicInpaint(
  context: ExtensionContext,
  mode: MusicInpaintMode,
  durationSec = 30,
): Promise<MusicInpaintModalResult | null> {
  const titles: Record<MusicInpaintMode, string> = {
    extend: "Extend Music",
    regenerate: "Regenerate Section",
    loop: "Make Seamless Loop",
    similar: "Generate Similar Music",
  };
  const fields: Record<MusicInpaintMode, string> = {
    extend: `<label>Intro (sec)</label><input id="introSec" type="number" min="3" max="120" value="15" />
<label>Outro (sec)</label><input id="outroSec" type="number" min="3" max="120" value="15" />`,
    regenerate: `<label>Regen start (sec)</label><input id="regenStartSec" type="number" min="0" value="0" />
<label>Regen end (sec)</label><input id="regenEndSec" type="number" min="1" value="${Math.max(1, Math.round(durationSec / 2))}" />
<label>Section text</label><textarea id="regenText" placeholder="[Chorus]&#10;New lyrics or directions"></textarea>`,
    loop: `<label>Slice start (sec)</label><input id="sliceStartSec" type="number" min="0" value="${Math.max(0, durationSec * 0.3).toFixed(1)}" />
<label>Slice end (sec)</label><input id="sliceEndSec" type="number" min="1" value="${Math.max(1, durationSec * 0.7).toFixed(1)}" />
<label>Glue (sec)</label><input id="glueSec" type="number" min="3" max="30" value="3" />`,
    similar: `<label>Prompt</label><textarea id="prompt" placeholder="Describe the new similar track"></textarea>
<label>Duration (sec)</label><input id="durationSec" type="number" min="6" max="600" value="${Math.min(60, Math.round(durationSec))}" />`,
  };
  const html = musicInpaintModalHtml
    .replace("{{TITLE}}", titles[mode])
    .replace("{{MODE}}", mode)
    .replace("{{DEFAULT_DURATION_SEC}}", String(Math.round(durationSec)))
    .replace("{{FIELDS}}", fields[mode]);
  const parsed = await showModal<MusicInpaintModalResult>(
    context,
    prepareModalHtml(html, titles[mode]),
    460,
    420,
    titles[mode],
  );
  if (parsed.cancelled) return null;
  return parsed;
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
  if (parsed.cancelled || !parsed.script?.trim() || !parsed.voiceA || !parsed.voiceB) {
    return null;
  }
  const validationError = validateDialogueInput(parsed.script, {
    voiceA: parsed.voiceA,
    voiceB: parsed.voiceB,
    voiceC: parsed.voiceC,
  });
  if (validationError) {
    return null;
  }
  return parsed;
}

export async function promptDrumRackSfx(
  context: ExtensionContext,
  _drumRack: DrumRack<"1.0.0">,
): Promise<DrumRackSfxModalResult | null> {
  const persisted = await getDrumKitSettings(context.environment.storageDirectory);
  const html = prepareDrumRackSfxModalHtml(drumRackSfxModalHtml, persisted);
  const parsed = await showModal<DrumRackSfxModalResult>(
    context,
    html,
    520,
    920,
    "Drum Rack SFX",
  );
  if (parsed.cancelled) return null;

  const pads = normalizeDrumPads(parsed);
  if (!pads.some((p) => p.enabled)) return null;

  const result = normalizeDrumRackSfxModalResult({ ...parsed, pads });
  await saveDrumKitSettings(context.environment.storageDirectory, {
    startMidiNote: result.startMidiNote ?? DRUM_RACK_START_NOTE,
    padMappingMode: result.padMappingMode ?? "sequential",
    overwriteOccupied: result.overwriteOccupied ?? false,
    kickKey: result.kickKey,
    snareKey: result.snareKey,
    pads: (result.pads ?? []).map((p) => ({
      padIndex: p.padIndex,
      type: p.type,
      stylePhrase: p.stylePhrase,
      durationSeconds: p.durationSeconds,
      autoDuration: p.autoDuration !== false,
    })),
  });
  return result;
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

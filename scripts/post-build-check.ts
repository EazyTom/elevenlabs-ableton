/**
 * Post-build validation for elevenlabs-ableton.
 *
 * Usage:
 *   npm run check:build              # bundle + version checks only
 *   npm run check:api                # bundle checks + ElevenLabs API smoke tests
 *   npm run check:api -- --full      # includes SFX generation (extra API cost)
 *
 * Requires ELEVENLABS_API_KEY or --storage-directory with api-key.txt for API tests.
 */
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { strToU8, zipSync } from "fflate";

import { AudioTrack, MidiTrack } from "@ableton-extensions/sdk";

import { importFilename, parseAudioOutputFormat } from "../src/audio-output-formats.js";
import { isAudioClipSlot } from "../src/clip-io.js";
import { parseDialogueScript } from "../src/dialogue.js";
import { buildMusicCompositionPlan, buildMusicPrompt, musicForceInstrumental, MUSIC_LOOP_SUFFIX, MUSIC_PROMPT_BANKS, MUSIC_TEMPLATE_STRINGS, randomMusicPrompt } from "../src/music-prompt.js";
import { clampMusicLengthMs, clampMusicLengthSec, MUSIC_MAX_LENGTH_SEC, MUSIC_MIN_LENGTH_SEC } from "../src/music-length.js";
import { clampMusicVariants, MAX_MUSIC_VARIANTS } from "../src/music-variants.js";
import { buildDrumKitPiecePrompt, DRUM_KIT_PIECES } from "../src/drum-kit.js";
import { buildSfxApiText, parseNegativePromptTerms } from "../src/prompt-utils.js";
import { randomSfxPrompt, SFX_LOOP_SUFFIX, SFX_PROMPT_BANKS } from "../src/sfx-prompt.js";
import { clampSfxVariants, MAX_SFX_VARIANTS } from "../src/sfx-variants.js";
import {
  createClient,
  generateSfx,
  generateTts,
  listVoices,
  resolveApiKey,
} from "../src/elevenlabs-client.js";
import { timedWordsToLyricNotes } from "../src/midi-io.js";
import { EXTENSION_VERSION } from "../src/version.js";
import { extractZipArchive, stemVolumeLevel } from "../src/zip-io.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SKIP_API = process.argv.includes("--skip-api");
const FULL_API = process.argv.includes("--full");
const storageArg = process.argv.find((a) => a.startsWith("--storage-directory="));
const storageDirectory = storageArg?.split("=")[1]
  ?? process.env.ELEVENLABS_STORAGE_DIRECTORY;

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function pass(name: string, detail: string): void {
  results.push({ name, ok: true, detail });
  console.log(`  ✓ ${name} — ${detail}`);
}

function fail(name: string, detail: string): never {
  results.push({ name, ok: false, detail });
  console.error(`  ✗ ${name} — ${detail}`);
  throw new Error(detail);
}

async function checkVersionsAlign(): Promise<void> {
  const manifest = JSON.parse(await readFile(path.join(ROOT, "manifest.json"), "utf-8")) as {
    version: string;
  };
  const pkg = JSON.parse(await readFile(path.join(ROOT, "package.json"), "utf-8")) as {
    version: string;
  };

  if (manifest.version !== EXTENSION_VERSION) {
    fail("version-sync", `manifest.json ${manifest.version} !== version.ts ${EXTENSION_VERSION}`);
  }
  if (pkg.version !== EXTENSION_VERSION) {
    fail("version-sync", `package.json ${pkg.version} !== version.ts ${EXTENSION_VERSION}`);
  }
  pass("version-sync", `all at v${EXTENSION_VERSION}`);
}

async function checkBundle(): Promise<void> {
  const bundlePath = path.join(ROOT, "dist", "extension.js");
  let bundle: string;
  try {
    bundle = await readFile(bundlePath, "utf-8");
  } catch {
    fail("bundle-exists", "dist/extension.js not found — run npm run build first");
  }

  const sizeMb = (Buffer.byteLength(bundle!, "utf-8") / (1024 * 1024)).toFixed(2);
  if (Buffer.byteLength(bundle!, "utf-8") < 500_000) {
    fail("bundle-size", `bundle suspiciously small (${sizeMb} MB)`);
  }
  pass("bundle-size", `${sizeMb} MB`);

  const markers = ["elevenlabs-ableton", "activate", "ElevenLabsClient", "registerContextMenuAction"];
  for (const marker of markers) {
    if (!bundle!.includes(marker)) {
      fail("bundle-content", `missing expected marker: ${marker}`);
    }
  }
  pass("bundle-content", `${markers.length} markers present`);

  if (!bundle!.includes(EXTENSION_VERSION)) {
    fail("bundle-version", `bundle does not reference ${EXTENSION_VERSION}`);
  }
  pass("bundle-version", `${EXTENSION_VERSION} embedded`);

  if (!bundle!.includes("--c-accent-secondary")) {
    fail("bundle-theme", "UI theme CSS variables not embedded");
  }
  pass("bundle-theme", "theme variables present");
}

function checkPureFunctions(): void {
  const lines = parseDialogueScript("1: Hello\n2: Hi there\n3: [excited] Me too", {
    voiceA: "voice-a",
    voiceB: "voice-b",
    voiceC: "voice-c",
  });
  if (
    lines.length !== 3 ||
    lines[0]!.voiceId !== "voice-a" ||
    lines[2]!.voiceId !== "voice-c"
  ) {
    fail("parseDialogueScript", "unexpected parse result");
  }
  pass("parseDialogueScript", "3-speaker lines parsed");

  const audioSlot = { parent: { constructor: { className: AudioTrack.className } } };
  const midiSlot = { parent: { constructor: { className: MidiTrack.className } } };
  if (!isAudioClipSlot(audioSlot as never) || isAudioClipSlot(midiSlot as never)) {
    fail("isAudioClipSlot", "unexpected track-type detection");
  }
  pass("isAudioClipSlot", "audio vs MIDI clip slots distinguished");

  const notes = timedWordsToLyricNotes(
    [{ text: "test", start: 0, end: 0.5 }],
    120,
    0,
  );
  if (notes.length !== 1 || notes[0]!.pitch !== 60) {
    fail("timedWordsToLyricNotes", "unexpected MIDI output");
  }
  pass("timedWordsToLyricNotes", "1 lyric marker at C4");

  if (stemVolumeLevel("vocals_stem.mp3") !== 0.9) {
    fail("stemVolumeLevel", "vocals level mismatch");
  }
  pass("stemVolumeLevel", "vocals → 0.9");

  const zipBytes = zipSync({ "drums.mp3": strToU8("fake-audio") });
  const entries = extractZipArchive(zipBytes);
  if (entries.length !== 1 || entries[0]!.name !== "drums.mp3") {
    fail("extractZipArchive", "ZIP round-trip failed");
  }
  pass("extractZipArchive", "1 entry extracted");

  const built = buildMusicPrompt({
    genres: ["trap", "epic", "dark"],
    tempoBpm: 140,
    prompt: "808 bass",
  });
  if (!built.includes("trap") || !built.includes("140 BPM") || !built.includes("808 bass") || !built.includes("dark")) {
    fail("buildMusicPrompt", `unexpected prompt: ${built}`);
  }
  if (!musicForceInstrumental({ genres: ["instrumental"] })) {
    fail("musicForceInstrumental", "instrumental genre should force instrumental");
  }
  pass("buildMusicPrompt", "genres + tempo merged");

  const musicPrompt = randomMusicPrompt({}, () => 0);
  if (!musicPrompt || musicPrompt.length < 20) {
    fail("randomMusicPrompt", "prompt too short");
  }
  if (!MUSIC_PROMPT_BANKS.genres.some((phrase) => musicPrompt.includes(phrase))) {
    fail("randomMusicPrompt", "prompt missing genre bank vocabulary");
  }
  if (!MUSIC_PROMPT_BANKS.textures.some((word) => musicPrompt.includes(word))) {
    fail("randomMusicPrompt", "prompt missing texture vocabulary");
  }
  if (MUSIC_TEMPLATE_STRINGS.length < 10) {
    fail("randomMusicPrompt", "expected at least 10 prompt templates");
  }
  pass("randomMusicPrompt", "descriptive phrase generated");

  const musicLoopPrompt = randomMusicPrompt({ loop: true }, () => 0);
  if (!musicLoopPrompt.includes(MUSIC_LOOP_SUFFIX)) {
    fail("randomMusicPrompt-loop", "loop suffix missing");
  }
  pass("randomMusicPrompt-loop", "loop suffix appended");

  if (clampMusicVariants(undefined) !== 1 || clampMusicVariants(0) !== 1) {
    fail("clampMusicVariants", "default should be 1");
  }
  if (clampMusicVariants(10) !== 10 || clampMusicVariants(99) !== MAX_MUSIC_VARIANTS) {
    fail("clampMusicVariants", "max should be 10");
  }
  pass("clampMusicVariants", "clamped to 1–10");

  if (clampMusicLengthSec(2) !== MUSIC_MIN_LENGTH_SEC || clampMusicLengthSec(999) !== MUSIC_MAX_LENGTH_SEC) {
    fail("clampMusicLengthSec", "expected 3–600 second clamp");
  }
  if (clampMusicLengthMs(2_000) !== 3_000 || clampMusicLengthMs(999_000) !== 600_000) {
    fail("clampMusicLengthMs", "expected 3000–600000 ms clamp");
  }
  pass("music-length", "API bounds enforced");

  const sfxPrompt = randomSfxPrompt({}, () => 0);
  if (!sfxPrompt || sfxPrompt.length < 20) {
    fail("randomSfxPrompt", "prompt too short");
  }
  if (!SFX_PROMPT_BANKS.textures.some((word) => sfxPrompt.includes(word))) {
    fail("randomSfxPrompt", "prompt missing bank vocabulary");
  }
  pass("randomSfxPrompt", "descriptive phrase generated");

  const loopPrompt = randomSfxPrompt({ loop: true }, () => 0);
  if (!loopPrompt.includes(SFX_LOOP_SUFFIX)) {
    fail("randomSfxPrompt-loop", "loop suffix missing");
  }
  pass("randomSfxPrompt-loop", "loop suffix appended");

  if (clampSfxVariants(undefined) !== 1 || clampSfxVariants(0) !== 1) {
    fail("clampSfxVariants", "default should be 1");
  }
  if (clampSfxVariants(10) !== 10 || clampSfxVariants(99) !== MAX_SFX_VARIANTS) {
    fail("clampSfxVariants", "max should be 10");
  }
  pass("clampSfxVariants", "clamped to 1–10");

  const negTerms = parseNegativePromptTerms("distortion, vocals");
  if (negTerms.length !== 2) {
    fail("parseNegativePromptTerms", "expected two terms");
  }
  const sfxText = buildSfxApiText("cinematic whoosh", "distortion, harsh highs");
  if (!sfxText.includes("Avoid:") || !sfxText.includes("distortion")) {
    fail("buildSfxApiText", `unexpected text: ${sfxText}`);
  }
  pass("buildSfxApiText", "negative terms appended");

  const plan = buildMusicCompositionPlan("trap, dark", ["vocals"], 30_000);
  const styles = plan.positive_global_styles as string[];
  const negatives = plan.negative_global_styles as string[];
  if (!styles.includes("trap") || !negatives.includes("vocals")) {
    fail("buildMusicCompositionPlan", "plan styles missing");
  }
  const instrumentalPlan = buildMusicCompositionPlan("ambient", ["distortion"], 30_000, {
    forceInstrumental: true,
  });
  const instrumentalNegatives = instrumentalPlan.negative_global_styles as string[];
  if (!instrumentalNegatives.includes("vocals") || !instrumentalNegatives.includes("distortion")) {
    fail("buildMusicCompositionPlan-instrumental", "instrumental negatives missing");
  }
  pass("buildMusicCompositionPlan", "composition plan built");

  if (parseAudioOutputFormat("pcm_44100") !== "pcm_44100") {
    fail("parseAudioOutputFormat", "pcm not parsed");
  }
  if (importFilename("elevenlabs-sfx", "pcm_44100") !== "elevenlabs-sfx.wav") {
    fail("importFilename", "pcm should use wav extension");
  }
  pass("audio-output-formats", "format parsing + filenames");

  const kickPrompt = buildDrumKitPiecePrompt("lo-fi trap", DRUM_KIT_PIECES[0]!);
  if (!kickPrompt.includes("lo-fi trap") || !kickPrompt.includes("kick")) {
    fail("buildDrumKitPiecePrompt", `unexpected kit prompt: ${kickPrompt}`);
  }
  pass("buildDrumKitPiecePrompt", "base + kick suffix merged");

  if (DRUM_KIT_PIECES.length !== 7) {
    fail("DRUM_KIT_PIECES", "expected 7 kit pieces");
  }
  pass("DRUM_KIT_PIECES", "7 kit pieces defined");
}

async function checkApiSmoke(): Promise<void> {
  if (SKIP_API) {
    console.log("\nAPI smoke tests skipped (--skip-api).");
    return;
  }

  let apiKey: string;
  try {
    apiKey = await resolveApiKey(storageDirectory);
  } catch {
    console.log("\nAPI smoke tests skipped (no ELEVENLABS_API_KEY or api-key.txt).");
    return;
  }

  const client = createClient(apiKey);

  const voices = await listVoices(client);
  if (!voices.length) {
    fail("api-voices-search", "voices.search returned empty list");
  }
  pass("api-voices-search", `${voices.length} voices (page 1)`);

  const ttsBytes = await generateTts(client, { text: "Ableton extension smoke test." });
  if (ttsBytes.byteLength < 500) {
    fail("api-tts", `TTS response too small (${ttsBytes.byteLength} bytes)`);
  }
  pass("api-tts", `${ttsBytes.byteLength} bytes MP3`);

  if (FULL_API) {
    const sfxBytes = await generateSfx(client, { text: "short click", durationSeconds: 1 });
    if (sfxBytes.byteLength < 200) {
      fail("api-sfx", `SFX response too small (${sfxBytes.byteLength} bytes)`);
    }
    pass("api-sfx", `${sfxBytes.byteLength} bytes MP3`);
  }
}

async function main(): Promise<void> {
  console.log(`\npost-build-check — elevenlabs-ableton v${EXTENSION_VERSION}\n`);

  console.log("Bundle checks:");
  await checkVersionsAlign();
  await checkBundle();

  console.log("\nUnit checks:");
  checkPureFunctions();

  console.log("\nAPI smoke tests:");
  await checkApiSmoke();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.\n`);

  if (failed.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nPost-build check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});

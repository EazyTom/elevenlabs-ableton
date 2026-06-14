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
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { strToU8, zipSync } from "fflate";

import { AudioTrack, MidiTrack } from "@ableton-extensions/sdk";

import { importFilename, parseAudioOutputFormat } from "../src/audio-output-formats.js";
import { isAudioClipSlot } from "../src/clip-io.js";
import { parseDialogueScript, validateDialogueInput } from "../src/dialogue.js";
import {
  buildMusicCompositionPlan,
  buildMusicPrompt,
  musicForceInstrumental,
  MUSIC_LOOP_SUFFIX,
  MUSIC_PROMPT_BANKS,
  MUSIC_TEMPLATE_STRINGS,
  randomMusicPrompt,
} from "../src/music-prompt.js";
import {
  clampMusicLengthMs,
  clampMusicLengthSec,
  MUSIC_MAX_LENGTH_SEC,
  MUSIC_MIN_LENGTH_SEC,
} from "../src/music-length.js";
import { clampMusicVariants, MAX_MUSIC_VARIANTS } from "../src/music-variants.js";
import {
  DEFAULT_KIT_TYPE_BY_PAD,
  assertEnabledDrumPadsMidiRange,
  DRUM_PAD_SLOT_COUNT,
  DRUM_TYPES,
  DRUM_TYPE_STYLE_BANKS,
  drumPadMidiNote,
  noteName,
  resolveDrumPadPrompt,
} from "../src/drum-kit.js";
import { isMidiTrack } from "../src/sdk-objects.js";
import {
  apiKeyFilePath,
  clearApiKeyFile,
  saveApiKeyToStorage,
} from "../src/api-key.js";
import { getDrumKitSettings, saveDrumKitSettings } from "../src/storage.js";
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

  const markers = [
    "elevenlabs-ableton",
    "activate",
    "ElevenLabsClient",
    "registerContextMenuAction",
    "--c-accent-secondary",
  ];
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
}

function checkPureFunctions(): void {
  const lines = parseDialogueScript("A: Hello\nB: Hi there\nC: [excited] Me too", {
    voiceA: "voice-a",
    voiceB: "voice-b",
    voiceC: "voice-c",
  });
  const legacy = parseDialogueScript("1: One\n2: Two", {
    voiceA: "voice-a",
    voiceB: "voice-b",
  });
  const validation = validateDialogueInput("A: Hi\nB: There", {
    voiceA: "a",
    voiceB: "b",
  });
  if (
    lines.length !== 3 ||
    lines[0]!.voiceId !== "voice-a" ||
    lines[2]!.voiceId !== "voice-c" ||
    legacy.length !== 2 ||
    validation !== null
  ) {
    fail("dialogue", "parse or validate failed");
  }
  pass("dialogue", "A/B/C, legacy numeric, optional Speaker C");

  const audioSlot = { parent: { constructor: { className: AudioTrack.className } } };
  const midiSlot = { parent: { constructor: { className: MidiTrack.className } } };
  if (!isAudioClipSlot(audioSlot as never) || isAudioClipSlot(midiSlot as never)) {
    fail("track-type-detection", "unexpected audio clip slot detection");
  }
  if (!isMidiTrack(midiSlot.parent) || isMidiTrack(audioSlot.parent)) {
    fail("track-type-detection", "unexpected MIDI track detection");
  }
  pass("track-type-detection", "audio vs MIDI clip slots distinguished");

  if (
    clampMusicVariants(undefined) !== 1 ||
    clampMusicVariants(0) !== 1 ||
    clampMusicVariants(99) !== MAX_MUSIC_VARIANTS ||
    clampSfxVariants(undefined) !== 1 ||
    clampSfxVariants(99) !== MAX_SFX_VARIANTS ||
    clampMusicLengthSec(2) !== MUSIC_MIN_LENGTH_SEC ||
    clampMusicLengthSec(999) !== MUSIC_MAX_LENGTH_SEC ||
    clampMusicLengthMs(2_000) !== 3_000 ||
    clampMusicLengthMs(999_000) !== 600_000
  ) {
    fail("clamps", "variant or length bounds wrong");
  }
  pass("clamps", "music/SFX variants and length bounds");

  const built = buildMusicPrompt({
    genres: ["trap", "epic", "dark"],
    tempoBpm: 140,
    prompt: "808 bass",
  });
  const musicPrompt = randomMusicPrompt({}, () => 0);
  const musicLoopPrompt = randomMusicPrompt({ loop: true }, () => 0);
  const plan = buildMusicCompositionPlan("trap, dark", ["vocals"], 30_000);
  const instrumentalPlan = buildMusicCompositionPlan("ambient", ["distortion"], 30_000, {
    forceInstrumental: true,
  });
  const styles = plan.positive_global_styles as string[];
  const negatives = plan.negative_global_styles as string[];
  const instrumentalNegatives = instrumentalPlan.negative_global_styles as string[];
  if (
    !built.includes("trap") ||
    !built.includes("140 BPM") ||
    !built.includes("808 bass") ||
    !musicForceInstrumental({ genres: ["instrumental"] }) ||
    !musicPrompt ||
    musicPrompt.length < 20 ||
    !MUSIC_PROMPT_BANKS.genres.some((phrase) => musicPrompt.includes(phrase)) ||
    !MUSIC_PROMPT_BANKS.textures.some((word) => musicPrompt.includes(word)) ||
    MUSIC_TEMPLATE_STRINGS.length < 10 ||
    !musicLoopPrompt.includes(MUSIC_LOOP_SUFFIX) ||
    !styles.includes("trap") ||
    !negatives.includes("vocals") ||
    !instrumentalNegatives.includes("vocals") ||
    !instrumentalNegatives.includes("distortion")
  ) {
    fail("music-prompt", "build, randomize, or composition plan failed");
  }
  pass("music-prompt", "genres, randomizer, loop, composition plan");

  const sfxPrompt = randomSfxPrompt({}, () => 0);
  const loopPrompt = randomSfxPrompt({ loop: true }, () => 0);
  const negTerms = parseNegativePromptTerms("distortion, vocals");
  const sfxText = buildSfxApiText("cinematic whoosh", "distortion, harsh highs");
  if (
    !sfxPrompt ||
    sfxPrompt.length < 20 ||
    !SFX_PROMPT_BANKS.textures.some((word) => sfxPrompt.includes(word)) ||
    !loopPrompt.includes(SFX_LOOP_SUFFIX) ||
    negTerms.length !== 2 ||
    !sfxText.includes("Avoid:") ||
    !sfxText.includes("distortion")
  ) {
    fail("sfx-prompt", "randomizer or avoid clause failed");
  }
  pass("sfx-prompt", "randomizer, loop suffix, negative terms");

  if (
    parseAudioOutputFormat("pcm_44100") !== "pcm_44100" ||
    importFilename("elevenlabs-sfx", "pcm_44100") !== "elevenlabs-sfx.wav"
  ) {
    fail("audio-output-formats", "format parsing or filename wrong");
  }
  pass("audio-output-formats", "format parsing + filenames");

  const kickType = DRUM_TYPES[0]!;
  const resolved = resolveDrumPadPrompt("lo-fi trap", kickType.defaultCharacteristics, "kick");
  const fallback = resolveDrumPadPrompt("", undefined, "kick");
  const kickKeyPrompt = resolveDrumPadPrompt("Punchy 808", kickType.defaultCharacteristics, "kick", "F");
  const snareKeyPrompt = resolveDrumPadPrompt("Tight studio", DRUM_TYPES[1]!.defaultCharacteristics, "snare", "G");
  if (
    !resolved.includes("lo-fi trap") ||
    !resolved.includes("0.25s") ||
    !resolved.includes("Avoid:") ||
    !resolved.includes("long pre-roll") ||
    !fallback.includes("kick drum") ||
    !fallback.includes("matched kit loudness") ||
    !kickKeyPrompt.includes("tuned to F") ||
    !snareKeyPrompt.includes("tuned to G")
  ) {
    fail("drum-prompt", "style merge, constraints, or pitch key failed");
  }

  for (const drumType of DRUM_TYPES) {
    const bank = DRUM_TYPE_STYLE_BANKS[drumType.id];
    if (!bank) continue;
    for (const phrase of bank) {
      const len = resolveDrumPadPrompt(phrase, drumType.defaultCharacteristics, drumType.id, "F#").length;
      if (len > 450) {
        fail("drum-prompt", `${drumType.id} prompt exceeds 450 chars (${len})`);
      }
    }
  }

  for (const drumType of DRUM_TYPES) {
    const bank = DRUM_TYPE_STYLE_BANKS[drumType.id];
    if (!bank?.length) {
      fail("drum-config", `${drumType.id} style bank empty`);
    }
    if (bank && new Set(bank).size !== bank.length) {
      fail("drum-config", `${drumType.id} has duplicate style phrases`);
    }
    if (!drumType.defaultCharacteristics.trim()) {
      fail("drum-config", `${drumType.id} missing characteristics`);
    }
    if (drumType.defaultDurationSeconds * 2 !== Math.round(drumType.defaultDurationSeconds * 2)) {
      fail("drum-config", `${drumType.id} duration not on 0.5s grid`);
    }
  }
  if (DEFAULT_KIT_TYPE_BY_PAD.length !== DRUM_PAD_SLOT_COUNT) {
    fail("drum-config", "default kit mapping length mismatch");
  }
  pass("drum-prompt", "prompt merge + drum config invariants");

  const sequential = drumPadMidiNote(1, 36, "sequential");
  const gmSnare = drumPadMidiNote(1, 36, "gm", "snare");
  if (
    noteName(36) !== "C1" ||
    sequential !== 37 ||
    drumPadMidiNote(0, 36, "gm", "kick") !== 36 ||
    gmSnare !== 38 ||
    sequential === gmSnare
  ) {
    fail("drum-mapping", "sequential vs GM note mapping wrong");
  }
  try {
    assertEnabledDrumPadsMidiRange(
      [
        { padIndex: 0, type: "kick" },
        { padIndex: 1, type: "kick" },
      ],
      36,
      "gm",
    );
    fail("drum-mapping", "GM duplicate types should throw");
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("GM mapping")) {
      fail("drum-mapping", `unexpected GM duplicate error: ${err}`);
    }
  }
  pass("drum-mapping", "sequential vs GM, duplicate GM rejected");

  const notes = timedWordsToLyricNotes(
    [{ text: "test", start: 0, end: 0.5 }],
    120,
    0,
  );
  const zipBytes = zipSync({ "drums.mp3": strToU8("fake-audio") });
  const entries = extractZipArchive(zipBytes);
  if (
    notes.length !== 1 ||
    notes[0]!.pitch !== 60 ||
    stemVolumeLevel("vocals_stem.mp3") !== 0.9 ||
    entries.length !== 1 ||
    entries[0]!.name !== "drums.mp3"
  ) {
    fail("audio-midi-utils", "lyric notes, stem level, or ZIP extract failed");
  }
  pass("audio-midi-utils", "lyrics, stem level, ZIP extract");
}

async function checkAsyncStorage(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "el-kit-"));
  try {
    await saveApiKeyToStorage(tempDir, "  sk_test_key  ");
    const keyPath = apiKeyFilePath(tempDir);
    const saved = (await readFile(keyPath, "utf-8")).trim();
    if (saved !== "sk_test_key") {
      fail("storage", `unexpected saved key: ${saved}`);
    }
    await clearApiKeyFile(tempDir);
    try {
      await readFile(keyPath, "utf-8");
      fail("storage", "api-key.txt should be removed");
    } catch {
      // expected
    }

    await saveDrumKitSettings(tempDir, {
      startMidiNote: 36,
      overwriteOccupied: false,
      pads: [{ padIndex: 0, type: "kick", stylePhrase: "test", durationSeconds: 1 }],
    });
    const loaded = await getDrumKitSettings(tempDir);
    if (!loaded?.pads[0]?.stylePhrase || loaded.pads[0]?.type !== "kick") {
      fail("storage", "drum kit round-trip failed");
    }
    pass("storage", "api-key + drumKit round-trip");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
  await checkAsyncStorage();

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

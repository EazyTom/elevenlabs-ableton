/**
 * Music v2.5 composeDetailed + one seamless-loop inpaint.
 * Costs API credits. Run: npm run test:music
 */
import "../src/install-globals.js";

import { writeFile, mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

import { formatApiError } from "../src/api-errors.js";
import {
  composeInpaintingMusic,
  createClient,
  generateMusicWithMetadata,
  resolveApiKey,
} from "../src/elevenlabs-client.js";
import { buildSeamlessLoopPlan } from "../src/music-inpainting.js";
import { musicLocatorSegments } from "../src/live-markers.js";

async function main(): Promise<void> {
  const apiKey = await resolveApiKey(process.env.ELEVENLABS_STORAGE_DIRECTORY);
  const client = createClient(apiKey);

  console.log("music_v2_5 composeDetailed...");
  const result = await generateMusicWithMetadata(client, {
    prompt: "short ambient electronic bed, instrumental",
    musicLengthMs: 10_000,
    modelId: "music_v2_5",
    storeForInpainting: true,
    forceInstrumental: true,
  });
  if (result.bytes.byteLength < 200) throw new Error("Audio too small");
  if (!result.songId) throw new Error("No songId");
  const words = result.words ?? [];
  if (!Array.isArray(words)) throw new Error("words timestamps missing");
  const sections = musicLocatorSegments(result.compositionPlan);
  if (!sections.length) {
    const preview = JSON.stringify(result.compositionPlan)?.slice(0, 1500) ?? "missing";
    throw new Error(`composition plan has no section durations: ${preview}`);
  }
  console.log(`  audio ${result.bytes.byteLength} bytes, songId ${result.songId}, sections ${sections.length}, words ${words.length}`);

  console.log("seamless-loop inpaint...");
  const plan = buildSeamlessLoopPlan(result.songId, 2_000, 6_000, 3_000, ["ambient", "electronic"]);
  const looped = await composeInpaintingMusic(client, plan, {
    modelId: "music_v2_5",
    storeForInpainting: true,
  });
  if (looped.bytes.byteLength < 200) throw new Error("Inpaint audio too small");
  const dir = await mkdtemp(path.join(tmpdir(), "el-music-"));
  await writeFile(path.join(dir, "loop.mp3"), looped.bytes);
  console.log(`  inpaint ${looped.bytes.byteLength} bytes`);
  console.log("test:music PASS");
}

main().catch((err) => {
  const message = formatApiError(err);
  if (/payment_issue|payment_required|incomplete payment/i.test(message)) {
    console.log(`test:music SKIP: ElevenLabs payment_issue — ${message.replace(/\s+/g, " ").slice(0, 220)}`);
    process.exit(0);
  }
  console.error("test:music FAIL:", message);
  process.exit(1);
});

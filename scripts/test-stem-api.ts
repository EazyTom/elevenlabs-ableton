import { writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { formatApiError } from "../src/api-errors.js";
import {
  createClient,
  generateSfx,
  resolveApiKey,
  separateMusicStems,
} from "../src/elevenlabs-client.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const storage = process.env.ELEVENLABS_STORAGE_DIRECTORY ?? path.dirname(ROOT);

async function main(): Promise<void> {
  const apiKey = await resolveApiKey(storage);
  const client = createClient(apiKey);

  console.log("Generating short SFX for stem test...");
  const sfx = await generateSfx(client, { text: "short drum beat", durationSeconds: 3 });
  const tmp = path.join(storage, "stem-test.mp3");
  await writeFile(tmp, sfx);
  console.log(`Wrote ${sfx.byteLength} bytes to ${tmp}`);

  const { FormData } = await import("formdata-polyfill/esm.min.js");
  globalThis.FormData = FormData as typeof globalThis.FormData;
  console.log("Simulating Live Extension Host (formdata-polyfill FormData)...");

  try {
    const zip = await separateMusicStems(client, tmp, "two_stems_v1");
    console.log(`Stem separation OK under polyfill: ${zip.byteLength} bytes zip`);
  } catch (err) {
    console.log("Stem separation failed:", formatApiError(err));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { AudioTrack } from "@ableton-extensions/sdk";

import type { ExtensionContext } from "./live-selection.js";

function silentWav(): Buffer {
  const sampleRate = 44_100;
  const dataSize = sampleRate * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

/**
 * Exercises cue points, clip name/color, and take-lane naming against the open Live Set.
 * Enabled only when ELEVENLABS_SELFTEST=1. Cleans up what it creates.
 */
export async function runLiveSelfTest(context: ExtensionContext): Promise<void> {
  const song = context.application.song;
  try {
    const cue = await song.createCuePoint(4);
    cue.name = "EL selftest";
    if (cue.name !== "EL selftest") {
      throw new Error(`cue name readback was "${cue.name}"`);
    }
    if (Math.abs(cue.time - 4) > 0.01) {
      throw new Error(`cue time readback was ${cue.time}`);
    }
    await song.deleteCuePoint(cue);

    const track = await song.createAudioTrack();
    if (!(track instanceof AudioTrack)) {
      throw new Error("createAudioTrack did not return an audio track");
    }
    const tempDirectory = context.environment.tempDirectory;
    if (!tempDirectory) throw new Error("tempDirectory is not available");
    await mkdir(tempDirectory, { recursive: true });
    const wavPath = path.join(tempDirectory, "elevenlabs-selftest.wav");
    await writeFile(wavPath, silentWav());
    const imported = await context.resources.importIntoProject(wavPath);
    const clip = await track.createAudioClip({ filePath: imported, startTime: 8, duration: 1 });
    clip.name = "EL selftest clip";
    clip.color = 0x00c853;
    if (clip.name !== "EL selftest clip") {
      throw new Error(`clip name readback was "${clip.name}"`);
    }
    if (clip.color !== 0x00c853) {
      throw new Error(`clip color readback was ${clip.color}`);
    }
    const takeLane = await track.createTakeLane();
    takeLane.name = "EL selftest take";
    if (takeLane.name !== "EL selftest take") {
      throw new Error(`take lane name readback was "${takeLane.name}"`);
    }
    await song.deleteTrack(track);
    console.log("[elevenlabs-ableton] selftest PASS");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[elevenlabs-ableton] selftest FAIL: ${message}`);
  }
}

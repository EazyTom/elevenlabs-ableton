import { writeFile } from "fs/promises";
import path from "path";
import type { ExtensionContext } from "@ableton-extensions/sdk";
import {
  AudioClip,
  AudioTrack,
  ClipSlot,
  Simpler,
  TakeLane,
} from "@ableton-extensions/sdk";

export interface ImportClipArgs {
  startTime?: number;
  duration?: number;
  isWarped?: boolean;
  looping?: boolean;
}

export function requireTempDirectory(context: ExtensionContext<"1.0.0">): string {
  const tempDirectory = context.environment.tempDirectory;
  if (!tempDirectory) {
    throw new Error("tempDirectory is not available from the extension host.");
  }
  return tempDirectory;
}

export async function writeTempAudio(
  tempDirectory: string,
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  const filePath = path.join(tempDirectory, filename);
  await writeFile(filePath, bytes);
  return filePath;
}

export async function importAndCreateClip(
  context: ExtensionContext<"1.0.0">,
  sourcePath: string,
  args: ImportClipArgs,
  target: ClipSlot<"1.0.0"> | AudioTrack<"1.0.0"> | TakeLane<"1.0.0">,
): Promise<void> {
  const imported = await context.resources.importIntoProject(sourcePath);
  const isWarped = args.isWarped ?? false;

  let clip: AudioClip<"1.0.0">;

  if (target instanceof AudioTrack || target instanceof TakeLane) {
    clip = await target.createAudioClip({
      filePath: imported,
      startTime: args.startTime ?? 0,
      duration: args.duration,
      isWarped,
    });
  } else {
    clip = await target.createAudioClip({
      filePath: imported,
      isWarped,
    });
  }

  if (args.looping) {
    clip.looping = true;
  }
}

export async function replaceSimplerSample(
  context: ExtensionContext<"1.0.0">,
  sourcePath: string,
  simpler: Simpler<"1.0.0">,
): Promise<void> {
  const imported = await context.resources.importIntoProject(sourcePath);
  await simpler.replaceSample(imported);
}

export async function importBytesToSimpler(
  context: ExtensionContext<"1.0.0">,
  bytes: Uint8Array,
  filename: string,
  simpler: Simpler<"1.0.0">,
): Promise<void> {
  const tempPath = await writeTempAudio(requireTempDirectory(context), bytes, filename);
  const tx = context.withinTransaction(() => replaceSimplerSample(context, tempPath, simpler));
  await tx;
}

export async function renderSelectionAudio(
  context: ExtensionContext<"1.0.0">,
  track: AudioTrack<"1.0.0">,
  startTime: number,
  endTime: number,
): Promise<string> {
  return context.resources.renderPreFxAudio(track, startTime, endTime);
}

export async function resolveAudioPathForClip(clip: AudioClip<"1.0.0">): Promise<string | null> {
  const filePath = clip.filePath;
  return filePath || null;
}

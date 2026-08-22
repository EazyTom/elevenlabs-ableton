import type { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { uploadMusicForInpainting } from "./elevenlabs-client.js";
import type { ExtensionContext } from "./live-selection.js";
import { addStoredSong, findStoredSongByPath, loadStorageConfig } from "./storage.js";

/** Resolve ElevenLabs song ID for a Live audio file (storage lookup, then upload). */
export async function resolveSongIdForAudio(
  client: ElevenLabsClient,
  context: ExtensionContext,
  audioPath: string,
  options?: { prompt?: string; durationMs?: number; retryUpload?: boolean },
): Promise<string> {
  const storageDir = context.environment.storageDirectory;
  const config = await loadStorageConfig(storageDir);
  const stored = findStoredSongByPath(config, audioPath);

  if (stored?.songId && !options?.retryUpload) {
    return stored.songId;
  }

  const { songId } = await uploadMusicForInpainting(client, audioPath);
  await addStoredSong(storageDir, {
    songId,
    filePath: audioPath,
    prompt: options?.prompt,
    durationMs: options?.durationMs,
    createdAt: Date.now(),
  });
  return songId;
}

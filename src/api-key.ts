import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

import { createClient, listVoices } from "./elevenlabs-client.js";

const API_KEY_FILENAME = "api-key.txt";

async function readApiKeyFromDir(dir: string): Promise<string | undefined> {
  try {
    const key = (await readFile(path.join(dir, API_KEY_FILENAME), "utf-8")).trim();
    return key || undefined;
  } catch {
    return undefined;
  }
}

export function apiKeyFilePath(storageDirectory: string): string {
  return path.join(storageDirectory, API_KEY_FILENAME);
}

/** Non-throwing API key lookup (env var, then storage file). */
export async function tryResolveApiKey(storageDirectory: string | undefined): Promise<string | undefined> {
  if (process.env.ELEVENLABS_API_KEY?.trim()) {
    return process.env.ELEVENLABS_API_KEY.trim();
  }

  const searchDirs = [
    storageDirectory,
    process.env.ELEVENLABS_STORAGE_DIRECTORY?.trim(),
  ].filter((d): d is string => Boolean(d));

  for (const dir of searchDirs) {
    const key = await readApiKeyFromDir(dir);
    if (key) return key;
  }

  return undefined;
}

export async function saveApiKeyToStorage(storageDirectory: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error("API key cannot be empty.");
  }
  await mkdir(storageDirectory, { recursive: true });
  await writeFile(apiKeyFilePath(storageDirectory), `${trimmed}\n`, "utf-8");
}

export async function clearApiKeyFile(storageDirectory: string): Promise<void> {
  try {
    await unlink(apiKeyFilePath(storageDirectory));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT") throw err;
  }
}

export async function readApiKeyFromStorageFile(
  storageDirectory: string,
): Promise<string | undefined> {
  return readApiKeyFromDir(storageDirectory);
}

export async function hasStoredApiKeyFile(storageDirectory: string | undefined): Promise<boolean> {
  if (!storageDirectory) return false;
  const key = await readApiKeyFromDir(storageDirectory);
  return Boolean(key);
}

export type ApiKeyValidationResult =
  | { ok: true }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "network"; message: string };

/** Lightweight verify via voices search. */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidationResult> {
  try {
    const client = createClient(apiKey.trim());
    const voices = await listVoices(client);
    if (!voices.length) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/401|403|unauthorized|invalid api/i.test(message)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: false, reason: "network", message };
  }
}

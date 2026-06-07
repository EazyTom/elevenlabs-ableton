import { readFile, writeFile } from "fs/promises";
import path from "path";

export interface StoredClonedVoice {
  voiceId: string;
  name: string;
  createdAt: number;
}

export interface StoredPronunciationDictionary {
  id: string;
  versionId: string;
  name: string;
  createdAt: number;
}

export interface ExtensionStorageConfig {
  clonedVoices: StoredClonedVoice[];
  pronunciationDictionaries: StoredPronunciationDictionary[];
  activePronunciationDictionaryId?: string;
}

const CONFIG_FILENAME = "elevenlabs-config.json";

const EMPTY_CONFIG: ExtensionStorageConfig = {
  clonedVoices: [],
  pronunciationDictionaries: [],
};

function configPath(storageDirectory: string): string {
  return path.join(storageDirectory, CONFIG_FILENAME);
}

export async function loadStorageConfig(
  storageDirectory: string | undefined,
): Promise<ExtensionStorageConfig> {
  if (!storageDirectory) return { ...EMPTY_CONFIG };

  try {
    const raw = await readFile(configPath(storageDirectory), "utf-8");
    const parsed = JSON.parse(raw) as Partial<ExtensionStorageConfig>;
    return {
      clonedVoices: parsed.clonedVoices ?? [],
      pronunciationDictionaries: parsed.pronunciationDictionaries ?? [],
      activePronunciationDictionaryId: parsed.activePronunciationDictionaryId,
    };
  } catch {
    return { ...EMPTY_CONFIG };
  }
}

export async function saveStorageConfig(
  storageDirectory: string | undefined,
  config: ExtensionStorageConfig,
): Promise<void> {
  if (!storageDirectory) {
    throw new Error("storageDirectory is not available — cannot persist settings.");
  }
  await writeFile(configPath(storageDirectory), JSON.stringify(config, null, 2), "utf-8");
}

export async function addClonedVoice(
  storageDirectory: string | undefined,
  voice: StoredClonedVoice,
): Promise<void> {
  const config = await loadStorageConfig(storageDirectory);
  config.clonedVoices = [voice, ...config.clonedVoices.filter((v) => v.voiceId !== voice.voiceId)];
  await saveStorageConfig(storageDirectory, config);
}

export async function addPronunciationDictionary(
  storageDirectory: string | undefined,
  dictionary: StoredPronunciationDictionary,
  setActive = true,
): Promise<void> {
  const config = await loadStorageConfig(storageDirectory);
  config.pronunciationDictionaries = [
    dictionary,
    ...config.pronunciationDictionaries.filter((d) => d.id !== dictionary.id),
  ];
  if (setActive) {
    config.activePronunciationDictionaryId = dictionary.id;
  }
  await saveStorageConfig(storageDirectory, config);
}

export function getActivePronunciationDictionary(
  config: ExtensionStorageConfig,
): StoredPronunciationDictionary | undefined {
  if (!config.activePronunciationDictionaryId) return undefined;
  return config.pronunciationDictionaries.find(
    (d) => d.id === config.activePronunciationDictionaryId,
  );
}

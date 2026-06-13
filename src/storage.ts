import { readFile, writeFile } from "fs/promises";
import path from "path";

import {
  DEFAULT_KIT_TYPE_BY_PAD,
  defaultDurationForType,
  DRUM_PAD_SLOT_COUNT,
  DRUM_RACK_START_NOTE,
} from "./drum-kit.js";

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

export interface StoredDrumPadSettings {
  padIndex: number;
  type: string;
  stylePhrase: string;
  durationSeconds: number;
  autoDuration?: boolean;
}

export interface StoredDrumKitSettings {
  startMidiNote: number;
  overwriteOccupied: boolean;
  kickKey?: string;
  snareKey?: string;
  pads: StoredDrumPadSettings[];
}

export interface ExtensionStorageConfig {
  clonedVoices: StoredClonedVoice[];
  pronunciationDictionaries: StoredPronunciationDictionary[];
  activePronunciationDictionaryId?: string;
  drumKit?: StoredDrumKitSettings;
}

/** @deprecated Use StoredDrumPadSettings */
export type StoredDrumKitPadSettings = StoredDrumPadSettings;

function normalizeStoredDrumPad(
  raw: Partial<StoredDrumPadSettings> & { id?: string; promptPrefix?: string },
  padIndex: number,
): StoredDrumPadSettings {
  const type =
    raw.type ??
    (raw.id && DEFAULT_KIT_TYPE_BY_PAD.includes(raw.id as (typeof DEFAULT_KIT_TYPE_BY_PAD)[number])
      ? raw.id
      : DEFAULT_KIT_TYPE_BY_PAD[padIndex] ?? "kick");
  return {
    padIndex: raw.padIndex ?? padIndex,
    type,
    stylePhrase: raw.stylePhrase ?? raw.promptPrefix ?? "",
    durationSeconds: raw.durationSeconds ?? defaultDurationForType(type),
    autoDuration: raw.autoDuration !== false,
  };
}

function normalizeStoredDrumKit(raw: Partial<StoredDrumKitSettings> | undefined): StoredDrumKitSettings | undefined {
  if (!raw) return undefined;
  const pads: StoredDrumPadSettings[] = [];
  const rawPads = raw.pads ?? [];
  for (let i = 0; i < DRUM_PAD_SLOT_COUNT; i++) {
    const saved = rawPads.find((p) => p.padIndex === i) ?? rawPads[i];
    pads.push(normalizeStoredDrumPad(saved ?? {}, i));
  }
  return {
    startMidiNote: raw.startMidiNote ?? DRUM_RACK_START_NOTE,
    overwriteOccupied: raw.overwriteOccupied ?? false,
    kickKey: raw.kickKey,
    snareKey: raw.snareKey,
    pads,
  };
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
      drumKit: normalizeStoredDrumKit(parsed.drumKit),
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

export async function getDrumKitSettings(
  storageDirectory: string | undefined,
): Promise<StoredDrumKitSettings | undefined> {
  const config = await loadStorageConfig(storageDirectory);
  return config.drumKit;
}

export async function saveDrumKitSettings(
  storageDirectory: string | undefined,
  settings: StoredDrumKitSettings,
): Promise<void> {
  const config = await loadStorageConfig(storageDirectory);
  config.drumKit = settings;
  await saveStorageConfig(storageDirectory, config);
}

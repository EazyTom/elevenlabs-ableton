/** First drum rack pad (Live convention: C1 = MIDI 36). */
import { clampSfxApiText } from "./prompt-utils.js";

export const DRUM_RACK_START_NOTE = 36;

/** Number of configurable pad slots in the Drum Rack SFX modal. */
export const DRUM_PAD_SLOT_COUNT = 7;

export type DrumTypeId =
  | "kick"
  | "snare"
  | "openHat"
  | "closedHat"
  | "rimshot"
  | "perc"
  | "clap"
  | "other";

export interface DrumType {
  readonly id: DrumTypeId;
  readonly label: string;
  readonly defaultCharacteristics: string;
  readonly defaultDurationSeconds: number;
}

/** Live note names: MIDI 0 = C-2 (Ableton piano roll convention). */
const LIVE_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/**
 * Shared delivery rules appended to every drum pad prompt — keeps kit levels even and
 * caps pre-roll silence at ~250 ms so hits align in a Drum Rack.
 */
export const DRUM_PAD_SAMPLE_CONSTRAINTS =
  "one-shot drum rack sample, 0.25s silence then hard transient, no fade-in, single isolated hit, matched kit loudness, short dry decay";

/** Appended via avoid clause on every drum pad SFX request. */
export const DRUM_PAD_AVOID_TERMS =
  "long pre-roll, fade-in, weak hit, loud mismatch, reverb tail, room bed, multiple hits, loop";

/** Selectable drum types with one-shot generation characteristics. */
export const DRUM_TYPES: readonly DrumType[] = [
  {
    id: "kick",
    label: "Kick",
    defaultCharacteristics:
      "kick drum, punchy low-end thump, tight sub punch, focused mono body, short decay",
    defaultDurationSeconds: 1.0,
  },
  {
    id: "snare",
    label: "Snare",
    defaultCharacteristics:
      "snare drum, sharp mid-range crack, crisp snare wires, tight dry body, short decay",
    defaultDurationSeconds: 1.0,
  },
  {
    id: "openHat",
    label: "Open Hat",
    defaultCharacteristics:
      "open hi-hat, bright sizzle, controlled natural decay, single strike, dry",
    defaultDurationSeconds: 1.5,
  },
  {
    id: "closedHat",
    label: "Closed Hat",
    defaultCharacteristics:
      "closed hi-hat, tight crisp chick, very short decay, single strike, dry",
    defaultDurationSeconds: 0.5,
  },
  {
    id: "rimshot",
    label: "Rimshot",
    defaultCharacteristics:
      "rimshot, woody cross-stick crack, sharp percussive knock, short decay, dry",
    defaultDurationSeconds: 0.5,
  },
  {
    id: "perc",
    label: "Perc",
    defaultCharacteristics:
      "hand percussion, clear transient attack, dry studio tone, short decay",
    defaultDurationSeconds: 0.5,
  },
  {
    id: "clap",
    label: "Clap",
    defaultCharacteristics:
      "hand clap, layered snap stack, tight dry clap, short decay",
    defaultDurationSeconds: 1.0,
  },
  {
    id: "other",
    label: "Other",
    defaultCharacteristics:
      "percussive one-shot, clear attack, dry studio tone, short decay",
    defaultDurationSeconds: 1.0,
  },
] as const;

/** Default drum type per pad when Build entire kit is enabled. */
export const DEFAULT_KIT_TYPE_BY_PAD: readonly DrumTypeId[] = [
  "kick",
  "snare",
  "closedHat",
  "openHat",
  "rimshot",
  "clap",
  "perc",
] as const;

/** How enabled pads map to MIDI notes relative to the selected root C. */
export type DrumPadMappingMode = "sequential" | "gm";

/**
 * General MIDI drum offsets from anchor C (same layout as GM map from C1 / MIDI 36).
 * @see https://en.wikipedia.org/wiki/General_MIDI#Percussion
 */
export const GM_DRUM_OFFSET_BY_TYPE: Readonly<Record<DrumTypeId, number>> = {
  kick: 0,
  rimshot: 1,
  snare: 2,
  clap: 3,
  closedHat: 6,
  openHat: 10,
  perc: 12,
  other: 24,
};

/** Per-type style phrases for the pad randomizer. */
export const DRUM_TYPE_STYLE_BANKS: Readonly<Record<DrumTypeId, readonly string[]>> = {
  kick: [
    "Punchy 808 sub",
    "Deep booming sub",
    "Tight clicky beater attack",
    "Distorted trap 808",
    "Lo-fi vinyl thump",
    "Techno warehouse stomp",
    "Boom-bap dusty punch",
    "Hard-hitting drill sub",
    "Minimal dry thud",
    "Analog 909 punch",
    "Vintage 808 round thump",
    "Four-on-the-floor house thump",
    "Reggaeton dembow weight",
    "Industrial metallic stomp",
    "Soft felt-beater thud",
    "Snappy click-forward beater",
    "Phonk saturated sub",
    "Hip-hop knock",
    "DnB compressed punch",
    "Layered sub with click top",
  ],
  snare: [
    "Tight studio crack",
    "Crisp rimshot-forward",
    "Fat layered snap",
    "Lo-fi dusty crack",
    "Bright pop snare",
    "Dark trap crack",
    "Punchy live backbeat",
    "Short gated snap",
    "Brushed jazz snap",
    "Metallic piccolo crack",
    "Vintage 909 snap",
    "Clap-layered hybrid",
    "Dry funk backbeat",
    "Acoustic maple crack",
    "Punchy drill snare",
    "Tight ghost-note tap",
    "Boom-bap dusty snare",
    "House clap-snare blend",
    "Rock-kit dry crack",
    "Rolled trap snare hit",
  ],
  closedHat: [
    "Crisp digital tick",
    "Tight closed chick",
    "Lo-fi dusty hat",
    "Bright metallic tick",
    "Dark muted tick",
    "Trap roll slice",
    "Minimal techno tick",
    "Garage skippy chick",
    "Soft brushed closed",
    "808-style short hat",
    "Crunchy tape-saturated tick",
    "Dry funk chick",
    "Hyperpop bright tick",
    "Industrial sizzle tick",
    "Warm analog closed",
    "Acoustic kit closed",
    "909 metallic chick",
    "Snappy pedal hat",
    "Tight foot-hat tick",
    "Glassy short tick",
  ],
  openHat: [
    "Bright airy open",
    "Crisp controlled open",
    "Dark washy open",
    "Lo-fi tape-hiss open",
    "Live acoustic open",
    "Trap bright splash",
    "Minimal airy shimmer",
    "Garage shuffle open",
    "Jazz ride-adjacent open",
    "Metallic trashy open",
    "Soft breathy open",
    "Tight short open",
    "Vintage drum-machine open",
    "909 sizzling open",
    "808-style open hat",
    "Crunchy saturated open",
    "Sharp sizzly open",
    "Controlled mid-decay open",
    "Techno bright open",
    "Classic house open",
  ],
  rimshot: [
    "Woody acoustic rim",
    "Sharp cross-stick",
    "Bright rim click",
    "Dark woody knock",
    "Tight studio rim",
    "Lo-fi rim tap",
    "Latin cascara click",
    "Metallic edge crack",
    "Short percussive tick",
    "Warm maple rim",
    "Trap rim knock",
    "Minimal dry click",
    "Brushed rim texture",
    "Funk backbeat rim",
    "Industrial rim ping",
    "Tight ghost rim",
    "909 rim click",
    "Hollow wood knock",
    "Snappy stick click",
    "Reggae cross-stick",
  ],
  perc: [
    "Wood block knock",
    "Conga open slap",
    "Bongo high tap",
    "Shaker accent",
    "Tambourine jingle",
    "Cowbell ping",
    "Triangle ding",
    "Cabasa scrape",
    "Guiro short scrape",
    "Clave click",
    "Rototom hit",
    "Tabla na slap",
    "Djembe slap tone",
    "Agogo bell",
    "Castanet snap",
    "Electronic blip",
    "Timbale rim hit",
    "Cuica short call",
    "Finger-snap accent",
    "Woodblock claves hybrid",
  ],
  clap: [
    "Layered studio clap",
    "Tight single clap",
    "Stacked group clap",
    "Lo-fi dusty clap",
    "Bright pop clap",
    "Dark trap clap stack",
    "Short gated clap",
    "Vintage 808 clap",
    "Live hand clap",
    "Crisp digital snap",
    "Reggaeton dembow clap",
    "Minimal dry clap",
    "Garage shuffle clap",
    "Hyperpop stacked snap",
    "Industrial metallic clap",
    "Soft body clap",
    "909 clap",
    "Finger-snap hybrid",
    "Punchy group clap",
    "Tight dry clap",
  ],
  other: [
    "Lo-fi texture hit",
    "Punchy cinematic impact",
    "Glitchy digital pop",
    "Organic body thump",
    "Metallic scrape hit",
    "Glassy tap",
    "Rubber bounce",
    "Paper rustle snap",
    "Plastic click",
    "Stone knock",
    "Water droplet plop",
    "Subtle foley tap",
    "Noise-burst hit",
    "Warm analog blip",
    "Short noise sweep",
    "Minimal dry tick",
    "Vocal-chop stab",
    "Zap laser hit",
    "Tom-style body hit",
    "Crunchy bitcrushed hit",
  ],
} as const;

/** Chromatic pitch options for kick/snare key selectors (empty = None). */
export const DRUM_PITCH_KEY_OPTIONS: readonly string[] = [
  "",
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

/** @deprecated Use DRUM_PITCH_KEY_OPTIONS */
export const KICK_KEY_OPTIONS = DRUM_PITCH_KEY_OPTIONS;

export interface DrumKitStartNoteOption {
  readonly midiNote: number;
  readonly label: string;
}

export const DRUM_KIT_START_NOTE_OPTIONS: readonly DrumKitStartNoteOption[] = [
  { midiNote: 0, label: "C-2" },
  { midiNote: 12, label: "C-1" },
  { midiNote: 24, label: "C0" },
  { midiNote: 36, label: "C1" },
  { midiNote: 48, label: "C2" },
  { midiNote: 60, label: "C3" },
] as const;

const DRUM_TYPE_BY_ID = Object.fromEntries(DRUM_TYPES.map((t) => [t.id, t])) as Record<
  DrumTypeId,
  DrumType
>;

/** JSON for modal HTML injection. */
export const DRUM_TYPES_JSON = JSON.stringify(DRUM_TYPES);
export const DRUM_TYPE_STYLE_BANKS_JSON = JSON.stringify(DRUM_TYPE_STYLE_BANKS);
export const DRUM_TYPE_CHARACTERISTICS_JSON = JSON.stringify(
  Object.fromEntries(DRUM_TYPES.map((t) => [t.id, t.defaultCharacteristics])),
);
export const DEFAULT_KIT_TYPE_BY_PAD_JSON = JSON.stringify(DEFAULT_KIT_TYPE_BY_PAD);
export const GM_DRUM_OFFSET_BY_TYPE_JSON = JSON.stringify(GM_DRUM_OFFSET_BY_TYPE);
export const DRUM_PAD_SLOT_COUNT_JSON = String(DRUM_PAD_SLOT_COUNT);

/** Live piano-roll note label (e.g. 36 → "C1"). */
export function noteName(midiNote: number): string {
  const n = Math.round(midiNote);
  if (n < 0 || n > 127) return String(n);
  const octave = Math.floor(n / 12) - 2;
  return `${LIVE_NOTE_NAMES[n % 12]}${octave}`;
}

/** Clamp pad duration to 0.5 s grid (matches modal slider). */
export function clampPadDurationSeconds(seconds: number | undefined, fallback: number): number {
  const raw = Number.isFinite(seconds) ? seconds! : fallback;
  const clamped = Math.min(30, Math.max(0.5, raw));
  return Math.round(clamped * 2) / 2;
}

/** @deprecated Use clampPadDurationSeconds */
export const clampKitDurationSeconds = clampPadDurationSeconds;

export function drumTypeById(typeId: string): DrumType | undefined {
  return DRUM_TYPE_BY_ID[typeId as DrumTypeId];
}

export function defaultCharacteristicsForType(typeId: string): string {
  return drumTypeById(typeId)?.defaultCharacteristics ?? DRUM_TYPES[0]!.defaultCharacteristics;
}

export function defaultDurationForType(typeId: string): number {
  return drumTypeById(typeId)?.defaultDurationSeconds ?? 1;
}

/** MIDI note for a pad slot (sequential from root C, or GM offset by drum type). */
export function drumPadMidiNote(
  padIndex: number,
  startNote = DRUM_RACK_START_NOTE,
  mode: DrumPadMappingMode = "sequential",
  typeId?: string,
): number {
  if (mode === "gm") {
    const id = (typeId ?? DEFAULT_KIT_TYPE_BY_PAD[padIndex] ?? "kick") as DrumTypeId;
    const offset = GM_DRUM_OFFSET_BY_TYPE[id] ?? GM_DRUM_OFFSET_BY_TYPE.other;
    return startNote + offset;
  }
  return startNote + padIndex;
}

/** Validate that enabled pads fit within MIDI 0–127 for the chosen mapping mode. */
export function assertEnabledDrumPadsMidiRange(
  enabledPads: ReadonlyArray<{ padIndex: number; type: string }>,
  startNote: number,
  mode: DrumPadMappingMode = "sequential",
): void {
  if (startNote < 0 || startNote > 127) {
    throw new Error(`Root C MIDI note must be between 0 and 127 (got ${startNote}).`);
  }
  if (!enabledPads.length) {
    throw new Error("At least one pad is required.");
  }
  if (mode === "sequential") {
    const maxPadIndex = enabledPads.reduce((max, p) => Math.max(max, p.padIndex), 0);
    if (startNote + maxPadIndex > 127) {
      throw new Error(
        `${maxPadIndex + 1} consecutive pads from ${noteName(startNote)} would exceed MIDI 127.`,
      );
    }
    return;
  }
  const seen = new Map<number, string>();
  for (const pad of enabledPads) {
    const note = drumPadMidiNote(pad.padIndex, startNote, "gm", pad.type);
    if (note > 127) {
      throw new Error(
        `GM mapping for ${pad.type} (${noteName(note)}) exceeds MIDI 127 from root ${noteName(startNote)}.`,
      );
    }
    const label = drumTypeById(pad.type)?.label ?? pad.type;
    const existing = seen.get(note);
    if (existing) {
      throw new Error(
        `GM mapping: ${existing} and ${label} both map to ${noteName(note)} (${note}). Change a pad type or use Sequential.`,
      );
    }
    seen.set(note, label);
  }
}

/** Resolve full SFX prompt from style phrase + per-pad characteristics. */
export function resolveDrumPadPrompt(
  stylePhrase: string | undefined,
  characteristics: string | undefined,
  typeId: string,
  pitchKey?: string,
): string {
  const style = stylePhrase?.trim();
  const chars = characteristics?.trim() || defaultCharacteristicsForType(typeId);
  const core = style ? `${style}, ${chars}` : chars;
  let prompt = `${core}, ${DRUM_PAD_SAMPLE_CONSTRAINTS}`;
  const key = pitchKey?.trim();
  if (key && (typeId === "kick" || typeId === "snare")) {
    prompt = `${prompt}, tuned to ${key}`;
  }
  return clampSfxApiText(prompt, DRUM_PAD_AVOID_TERMS);
}

/** Inline script for drum pad style randomization in the modal webview. */
export function buildDrumPadRandomizerScript(): string {
  return `<script>
const DRUM_TYPES = ${DRUM_TYPES_JSON};
const DRUM_TYPE_STYLE_BANKS = ${DRUM_TYPE_STYLE_BANKS_JSON};
const DRUM_TYPE_CHARACTERISTICS = ${DRUM_TYPE_CHARACTERISTICS_JSON};
const DEFAULT_KIT_TYPE_BY_PAD = ${DEFAULT_KIT_TYPE_BY_PAD_JSON};
const GM_DRUM_OFFSET_BY_TYPE = ${GM_DRUM_OFFSET_BY_TYPE_JSON};
const DRUM_PAD_SLOT_COUNT = ${DRUM_PAD_SLOT_COUNT_JSON};

function pickTypeStyle(typeId) {
  const bank = DRUM_TYPE_STYLE_BANKS[typeId];
  if (!bank?.length) return "";
  return bank[Math.floor(Math.random() * bank.length)];
}

function applyTypeCharacteristics(padIndex) {
  const typeEl = document.getElementById("padType_" + padIndex);
  const charsEl = document.getElementById("padCharacteristics_" + padIndex);
  if (!typeEl || !charsEl) return;
  const typeId = typeEl.value;
  charsEl.value = DRUM_TYPE_CHARACTERISTICS[typeId] || "";
}

function randomizePadPhrase(padIndex) {
  const typeEl = document.getElementById("padType_" + padIndex);
  const phraseEl = document.getElementById("padPhrase_" + padIndex);
  if (!typeEl || !phraseEl) return;
  phraseEl.value = pickTypeStyle(typeEl.value);
}

function randomizeAllPadPhrases() {
  for (let i = 0; i < DRUM_PAD_SLOT_COUNT; i++) {
    randomizePadPhrase(i);
  }
}
</script>`;
}

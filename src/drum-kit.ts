/** First drum rack pad (Live convention: C1 = MIDI 36). */
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

/** Selectable drum types with one-shot generation characteristics. */
export const DRUM_TYPES: readonly DrumType[] = [
  {
    id: "kick",
    label: "Kick",
    defaultCharacteristics:
      "kick drum one-shot, minimal silence before transient, tight punchy low-end attack, short decay, single hit, no reverb tail",
    defaultDurationSeconds: 1.0,
  },
  {
    id: "snare",
    label: "Snare",
    defaultCharacteristics:
      "snare drum one-shot, minimal silence before transient, sharp mid-range crack, short body, single hit, dry",
    defaultDurationSeconds: 1.0,
  },
  {
    id: "openHat",
    label: "Open Hat",
    defaultCharacteristics:
      "open hi-hat one-shot, minimal silence before transient, bright sizzle, natural decay, single hit, no room tail",
    defaultDurationSeconds: 1.5,
  },
  {
    id: "closedHat",
    label: "Closed Hat",
    defaultCharacteristics:
      "closed hi-hat one-shot, minimal silence before transient, tight crisp chick, very short decay, single hit",
    defaultDurationSeconds: 0.5,
  },
  {
    id: "rimshot",
    label: "Rimshot",
    defaultCharacteristics:
      "rimshot one-shot, minimal silence before transient, sharp woody crack, percussive attack, short decay, single hit",
    defaultDurationSeconds: 0.5,
  },
  {
    id: "perc",
    label: "Perc",
    defaultCharacteristics:
      "percussion one-shot, minimal silence before transient, clear transient attack, short decay, single hit, dry",
    defaultDurationSeconds: 0.5,
  },
  {
    id: "clap",
    label: "Clap",
    defaultCharacteristics:
      "hand clap one-shot, minimal silence before transient, layered snap, short decay, single hit, tight room",
    defaultDurationSeconds: 1.0,
  },
  {
    id: "other",
    label: "Other",
    defaultCharacteristics:
      "percussive one-shot, minimal silence before transient, clear attack, short decay, single hit, no sustained tail",
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

/** Per-type style phrases for the pad randomizer. */
export const DRUM_TYPE_STYLE_BANKS: Readonly<Record<DrumTypeId, readonly string[]>> = {
  kick: [
    "Punchy 808-style",
    "Deep sub-heavy",
    "Distorted trap",
    "Lo-fi vinyl thump",
    "Techno warehouse kick",
    "Boom bap punch",
    "Short clicky attack",
    "Round house kick",
    "Dark drill sub",
    "Minimal dry thump",
    "Garage shuffle weight",
    "Cinematic trailer boom",
    "Reggaeton dembow thud",
    "Industrial metal stomp",
    "Soft felt mallet",
    "Tuned 808 with long tail",
  ],
  snare: [
    "Tight studio",
    "Crispy rim-forward",
    "Fat layered snap",
    "Lo-fi dusty crack",
    "Bright pop snare",
    "Dark trap crack",
    "Roomy live kit",
    "Short gated snare",
    "Brushy jazz snap",
    "Metallic piccolo crack",
    "Vintage 909 style",
    "Clap-layered hybrid",
    "Dry funk backbeat",
    "Wide stereo room",
    "Punchy drill snare",
    "Soft ghost-note texture",
  ],
  closedHat: [
    "Crisp digital",
    "Tight closed chick",
    "Lo-fi dusty hat",
    "Bright metallic tick",
    "Dark muted shuffle",
    "Trap hi-hat roll slice",
    "Minimal techno tick",
    "Garage skippy hat",
    "Soft brushed closed",
    "Short 808-style hat",
    "Crunchy lo-fi tape",
    "Dry funk chick",
    "Hyperpop bright tick",
    "Industrial sizzle",
    "Warm analog closed",
    "Percussive wood block hybrid",
  ],
  openHat: [
    "Bright airy",
    "Long sizzle wash",
    "Dark washy open",
    "Lo-fi tape hiss hat",
    "Crisp live open",
    "Trap bright splash",
    "Minimal airy shimmer",
    "Garage open shuffle",
    "Jazz ride-adjacent wash",
    "Metallic trashy open",
    "Soft breathy open",
    "Wide stereo wash",
    "Short controlled open",
    "Vintage drum machine open",
    "Cinematic swell hat",
    "Percussive cymbal choke",
  ],
  rimshot: [
    "Woody acoustic",
    "Sharp cross-stick",
    "Bright rim click",
    "Dark woody knock",
    "Tight studio rim",
    "Lo-fi rim tap",
    "Latin cascara-like",
    "Metallic edge crack",
    "Short percussive tick",
    "Warm maple rim",
    "Trap rim knock",
    "Minimal dry click",
    "Brush rim texture",
    "Funk backbeat rim",
    "Industrial rim ping",
    "Soft ghost rim",
  ],
  perc: [
    "Wood block knock",
    "Conga slap",
    "Bongo tap",
    "Shaker burst",
    "Tambourine jingle",
    "Cowbell ping",
    "Triangle ding",
    "Cabasa scrape",
    "Guiro scrape",
    "Clave click",
    "Tom fill hit",
    "Tabla slap",
    "Djembe thump",
    "Agogo bell",
    "Castanet snap",
    "Electronic blip",
  ],
  clap: [
    "Layered room",
    "Tight single clap",
    "Wide stereo stack",
    "Lo-fi dusty clap",
    "Bright pop clap",
    "Dark trap clap stack",
    "Short gated clap",
    "Vintage 808 clap",
    "Roomy live hand clap",
    "Crisp digital snap",
    "Reggaeton dembow clap",
    "Minimal dry clap",
    "Garage shuffle clap",
    "Hyperpop stacked snap",
    "Industrial metallic clap",
    "Soft body clap",
  ],
  other: [
    "Lo-fi texture hit",
    "Cinematic impact",
    "Glitchy digital pop",
    "Organic body thump",
    "Metallic scrape",
    "Glassy tap",
    "Rubber bounce",
    "Paper rustle snap",
    "Plastic click",
    "Stone knock",
    "Water droplet plop",
    "Subtle foley tap",
    "Experimental noise burst",
    "Warm analog blip",
    "Short noise sweep",
    "Minimal dry tick",
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

/** Consecutive MIDI note for a pad slot. */
export function drumPadMidiNote(padIndex: number, startNote = DRUM_RACK_START_NOTE): number {
  return startNote + padIndex;
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
  let prompt = style ? `${style}, ${chars}` : chars;
  const key = pitchKey?.trim();
  if (key && (typeId === "kick" || typeId === "snare")) {
    prompt = `${prompt}, tuned to ${key}`;
  }
  return prompt;
}

/** Inline script for drum pad style randomization in the modal webview. */
export function buildDrumPadRandomizerScript(): string {
  return `<script>
const DRUM_TYPES = ${DRUM_TYPES_JSON};
const DRUM_TYPE_STYLE_BANKS = ${DRUM_TYPE_STYLE_BANKS_JSON};
const DRUM_TYPE_CHARACTERISTICS = ${DRUM_TYPE_CHARACTERISTICS_JSON};
const DEFAULT_KIT_TYPE_BY_PAD = ${DEFAULT_KIT_TYPE_BY_PAD_JSON};
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

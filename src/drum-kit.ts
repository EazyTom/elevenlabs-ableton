/** First drum rack pad for auto-load / kit build (MIDI note 0 = C0). */
export const DRUM_RACK_START_NOTE = 0;

export interface DrumKitPiece {
  readonly id: string;
  readonly label: string;
  readonly promptSuffix: string;
  readonly defaultPrompt: string;
}

/** Standard kit pieces loaded to consecutive pads starting at C0 (MIDI 0). */
export const DRUM_KIT_PIECES: readonly DrumKitPiece[] = [
  {
    id: "kick",
    label: "Kick",
    promptSuffix: " punchy kick drum, tight low end, short decay, single hit",
    defaultPrompt: "Punchy 808-style kick drum, tight low end, short decay",
  },
  {
    id: "snare",
    label: "Snare",
    promptSuffix: " snare drum crack, mid-range body, short decay",
    defaultPrompt: "Snare drum crack with body and short decay",
  },
  {
    id: "closedHat",
    label: "Closed hi-hat",
    promptSuffix: " closed hi-hat, tight and crisp, short decay",
    defaultPrompt: "Closed hi-hat, tight crisp tick, short decay",
  },
  {
    id: "openHat",
    label: "Open hi-hat",
    promptSuffix: " open hi-hat, bright sizzle, natural decay",
    defaultPrompt: "Open hi-hat with bright sizzle and natural decay",
  },
  {
    id: "rimshot",
    label: "Rimshot",
    promptSuffix: " rimshot, sharp woody crack, percussive",
    defaultPrompt: "Rimshot with sharp woody crack",
  },
  {
    id: "clap",
    label: "Clap",
    promptSuffix: " hand clap, layered snap, short room ambience",
    defaultPrompt: "Layered hand clap with short room snap",
  },
  {
    id: "bass808",
    label: "808 bass",
    promptSuffix: " 808 bass hit, sub-heavy, long decay tail",
    defaultPrompt: "808 bass hit with sub-heavy body and long tail",
  },
] as const;

/** Merge user kit prompt with piece-specific SFX description. */
export function buildDrumKitPiecePrompt(basePrompt: string | undefined, piece: DrumKitPiece): string {
  const base = basePrompt?.trim();
  if (base) {
    return `${base},${piece.promptSuffix}`;
  }
  return piece.defaultPrompt;
}

export function drumKitMidiNote(pieceIndex: number, startNote = DRUM_RACK_START_NOTE): number {
  return startNote + pieceIndex;
}

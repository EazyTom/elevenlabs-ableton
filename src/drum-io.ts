import { DrumChain, DrumRack, Simpler } from "@ableton-extensions/sdk";

import type { ExtensionContext } from "./live-selection.js";
import { DRUM_RACK_START_NOTE } from "./drum-kit.js";

export interface DrumPadSummary {
  midiNote: number;
}

/** Drum rack chains that contain a Simpler, sorted by MIDI note. */
export function listPadsWithSimpler(drumRack: DrumRack<"1.0.0">): DrumPadSummary[] {
  const pads: DrumPadSummary[] = [];
  for (const chain of drumRack.chains) {
    if (!(chain instanceof DrumChain)) continue;
    for (const device of chain.devices) {
      if (device instanceof Simpler) {
        pads.push({ midiNote: chain.receivingNote });
        break;
      }
    }
  }
  return pads.sort((a, b) => a.midiNote - b.midiNote);
}

export function findDrumChainByNote(
  drumRack: DrumRack<"1.0.0">,
  midiNote: number,
): DrumChain<"1.0.0"> | null {
  for (const chain of drumRack.chains) {
    if (chain instanceof DrumChain && chain.receivingNote === midiNote) {
      return chain;
    }
  }
  return null;
}

/**
 * Find the Simpler device on a drum rack pad (by MIDI note number).
 */
export function findSimplerOnPad(drumRack: DrumRack<"1.0.0">, midiNote: number): Simpler<"1.0.0"> | null {
  const chain = findDrumChainByNote(drumRack, midiNote);
  if (!chain) return null;

  for (const device of chain.devices) {
    if (device instanceof Simpler) {
      return device;
    }
  }
  return null;
}

/**
 * Ensure a drum pad has a Simpler — creates a chain + inserts Simpler when missing.
 */
export async function ensureSimplerOnPad(
  context: ExtensionContext,
  drumRack: DrumRack<"1.0.0">,
  midiNote: number,
): Promise<Simpler<"1.0.0">> {
  const existing = findSimplerOnPad(drumRack, midiNote);
  if (existing) return existing;

  return context.withinTransaction(async () => {
    let chain = findDrumChainByNote(drumRack, midiNote);
    if (!chain) {
      const inserted = await drumRack.insertChain(drumRack.chains.length);
      if (!(inserted instanceof DrumChain)) {
        throw new Error(`Could not create drum pad at MIDI note ${midiNote}.`);
      }
      inserted.receivingNote = midiNote;
      chain = inserted;
    }

    const device = await chain.insertDevice("Simpler", 0);
    if (!(device instanceof Simpler)) {
      throw new Error(`Could not insert Simpler on MIDI note ${midiNote}.`);
    }
    return device;
  });
}

export function assertPadRange(startNote: number, count: number): void {
  if (startNote < 0 || startNote > 127) {
    throw new Error(`Start MIDI note must be between 0 and 127 (got ${startNote}).`);
  }
  if (count < 1) {
    throw new Error("At least one pad is required.");
  }
  if (startNote + count - 1 > 127) {
    throw new Error(
      `Pads C0+ need ${count} consecutive notes but exceed MIDI 127 (start ${startNote}).`,
    );
  }
}

export { DRUM_RACK_START_NOTE };

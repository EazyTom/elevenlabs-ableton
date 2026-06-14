import { ClipSlot, DrumChain, DrumRack, MidiTrack, Simpler } from "@ableton-extensions/sdk";
import type { Handle } from "@ableton-extensions/sdk";

import type { ExtensionContext } from "./live-selection.js";
import { resolveHandle } from "./live-selection.js";
import { isMidiTrack } from "./sdk-objects.js";

export { DRUM_RACK_START_NOTE } from "./drum-kit.js";

/**
 * Built-in Live device name for an empty Drum Rack (Browser → Drums → Drum Rack).
 * Requires manual smoke-test in Live before release if this ever fails at runtime.
 */
export const EMPTY_DRUM_RACK_DEVICE = "Drum Rack";

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

/** Find the Simpler device on a drum rack pad (by MIDI note number). */
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

/** Ensure a drum pad has a Simpler — creates a chain + inserts Simpler when missing. */
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

/** True when the pad already has a loaded Simpler sample. */
export function isDrumPadOccupied(drumRack: DrumRack<"1.0.0">, midiNote: number): boolean {
  const simpler = findSimplerOnPad(drumRack, midiNote);
  return simpler?.sample != null;
}

/** Find the first Drum Rack device on a MIDI track's device chain. */
export function findDrumRackOnTrack(track: { devices: readonly unknown[] }): DrumRack<"1.0.0"> | null {
  for (const device of track.devices) {
    if (device instanceof DrumRack) {
      return device;
    }
  }
  return null;
}

/** Insert Ableton's built-in empty Drum Rack at the start of a MIDI track's device chain. */
export async function insertEmptyDrumRackOnTrack(
  context: ExtensionContext,
  track: MidiTrack<"1.0.0">,
): Promise<DrumRack<"1.0.0">> {
  return context.withinTransaction(async () => {
    const device = await track.insertDevice(EMPTY_DRUM_RACK_DEVICE, 0);
    if (!(device instanceof DrumRack)) {
      throw new Error("Could not insert Drum Rack on this track.");
    }
    return device;
  });
}

/**
 * Resolve Drum Rack from a Session View MIDI clip slot.
 * When the track has no instruments, inserts an empty Drum Rack automatically.
 */
export async function ensureDrumRackFromClipSlot(
  context: ExtensionContext,
  handle: Handle,
): Promise<DrumRack<"1.0.0"> | null> {
  const slot = resolveHandle(context, handle, ClipSlot);
  const parent = slot.parent;
  if (!parent || !isMidiTrack(parent)) {
    return null;
  }

  const existing = findDrumRackOnTrack(parent);
  if (existing) return existing;

  if (parent.devices.length > 0) {
    return null;
  }

  return insertEmptyDrumRackOnTrack(context, parent);
}

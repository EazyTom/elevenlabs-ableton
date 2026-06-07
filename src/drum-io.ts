import { DrumChain, DrumRack, Simpler } from "@ableton-extensions/sdk";

/**
 * Find the Simpler device on a drum rack pad (by MIDI note number).
 */
export function findSimplerOnPad(drumRack: DrumRack<"1.0.0">, midiNote: number): Simpler<"1.0.0"> | null {
  for (const chain of drumRack.chains) {
    if (!(chain instanceof DrumChain)) continue;
    if (chain.receivingNote !== midiNote) continue;

    for (const device of chain.devices) {
      if (device instanceof Simpler) {
        return device;
      }
    }
  }
  return null;
}

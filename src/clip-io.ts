import { AudioTrack, ClipSlot, Track } from "@ableton-extensions/sdk";

import { isAudioTrack, isTrack } from "./sdk-objects.js";

/** Clip slots on the same track, starting at the selection and moving down in Session View. */
export function consecutiveClipSlotsFrom(
  startSlot: ClipSlot<"1.0.0">,
  count: number,
): ClipSlot<"1.0.0">[] {
  if (count < 1) {
    throw new Error("Variant count must be at least 1.");
  }

  const parent = startSlot.parent;
  if (!parent || !isTrack(parent)) {
    throw new Error("Selected clip slot is not on a track.");
  }
  if (!isAudioTrack(parent)) {
    throw new Error("Music variants require an audio track clip slot.");
  }

  const slots = parent.clipSlots;
  const startIndex = slots.findIndex((slot) => slot.handle === startSlot.handle);
  if (startIndex < 0) {
    throw new Error("Could not find the selected clip slot on its track.");
  }

  const available = slots.length - startIndex;
  if (count > available) {
    throw new Error(
      `Need ${count} clip slots starting at the selection, but only ${available} slot(s) remain on this track.`,
    );
  }

  return slots.slice(startIndex, startIndex + count);
}

import { AudioTrack, ClipSlot } from "@ableton-extensions/sdk";

import { isAudioTrack } from "./sdk-objects.js";

/** Session clip slots on audio tracks can receive imported audio clips. */
export function isAudioClipSlot(slot: ClipSlot<"1.0.0">): boolean {
  const parent = slot.parent;
  return Boolean(parent && isAudioTrack(parent));
}

/** Clip slots on the same track, starting at the selection and moving down in Session View. */
export function consecutiveClipSlotsFrom(
  startSlot: ClipSlot<"1.0.0">,
  count: number,
): ClipSlot<"1.0.0">[] {
  if (count < 1) {
    throw new Error("Variant count must be at least 1.");
  }

  if (!isAudioClipSlot(startSlot)) {
    throw new Error("Generated audio requires an audio track clip slot.");
  }

  const parent = startSlot.parent as AudioTrack<"1.0.0">;
  const slots = parent.clipSlots;
  const startIndex = slots.findIndex(
    (slot) => slot.handle === startSlot.handle || slot === startSlot,
  );
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

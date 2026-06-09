import type { ArrangementSelection, ClipSlotSelection, Handle, initialize } from "@ableton-extensions/sdk";
import { AudioTrack, ClipSlot, DataModelObject } from "@ableton-extensions/sdk";
import type { ImportClipArgs } from "./audio-io.js";
import { isAudioClipSlot } from "./clip-io.js";

export type ExtensionContext = ReturnType<typeof initialize>;

export function selectionDuration(selection: ArrangementSelection): number {
  return selection.time_selection_end - selection.time_selection_start;
}

export function arrangementClipArgs(selection: ArrangementSelection): ImportClipArgs {
  const duration = selectionDuration(selection);
  return {
    startTime: selection.time_selection_start,
    duration: duration > 0 ? duration : undefined,
  };
}

export function getPrimaryAudioTrack(
  context: ExtensionContext,
  selection: ArrangementSelection,
): AudioTrack<"1.0.0"> | null {
  const trackHandle = selection.selected_lanes[0];
  if (!trackHandle) return null;
  return context.getObjectFromHandle(trackHandle, AudioTrack);
}

export function resolveHandle<T extends DataModelObject<"1.0.0">>(
  context: ExtensionContext,
  handle: Handle,
  type: abstract new (...args: never) => T,
): T {
  return context.getObjectFromHandle(handle, type);
}

/** Resolve a session clip slot only when it belongs to an audio track. */
export function resolveAudioClipSlot(
  context: ExtensionContext,
  handle: Handle,
): ClipSlot<"1.0.0"> | null {
  const slot = resolveHandle(context, handle, ClipSlot);
  return isAudioClipSlot(slot) ? slot : null;
}

/** Keep only clip slots on audio tracks from a Session View multi-selection. */
export function audioClipSlotsFromSelection(
  context: ExtensionContext,
  selection: ClipSlotSelection,
): ClipSlot<"1.0.0">[] {
  const slots: ClipSlot<"1.0.0">[] = [];

  for (const handle of selection.selected_clip_slots) {
    try {
      const slot = resolveHandle(context, handle, ClipSlot);
      if (isAudioClipSlot(slot)) {
        slots.push(slot);
      }
    } catch {
      // Skip handles that are not clip slots.
    }
  }

  return slots;
}

import type { ArrangementSelection, Handle, initialize } from "@ableton-extensions/sdk";
import { AudioTrack, DataModelObject } from "@ableton-extensions/sdk";
import type { ImportClipArgs } from "./audio-io.js";

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

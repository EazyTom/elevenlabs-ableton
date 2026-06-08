import { AudioTrack, ClipSlot, Track } from "@ableton-extensions/sdk";

function sdkClassName(obj: unknown): string | undefined {
  const name = (obj as { constructor?: { className?: string } })?.constructor?.className;
  return typeof name === "string" ? name : undefined;
}

/** Host objects may not pass `instanceof` when the SDK is bundled — also check static className. */
export function isClipSlot(obj: unknown): obj is ClipSlot<"1.0.0"> {
  return obj instanceof ClipSlot || sdkClassName(obj) === ClipSlot.className;
}

export function isAudioTrack(obj: unknown): obj is AudioTrack<"1.0.0"> {
  return obj instanceof AudioTrack || sdkClassName(obj) === AudioTrack.className;
}

export function isTrack(obj: unknown): obj is Track<"1.0.0"> {
  return obj instanceof Track || sdkClassName(obj) === Track.className;
}

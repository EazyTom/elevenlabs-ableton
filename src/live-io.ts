import { AudioTrack, Device } from "@ableton-extensions/sdk";

const REVERB_PARAM_NAMES = ["Dry/Wet", "Mix", "Reverb Mix", "Wet Level"];

/**
 * Light post-import polish: set track volume and nudge a reverb mix if found.
 */
export async function applyVocalPostFx(track: AudioTrack<"1.0.0">): Promise<void> {
  if (track.mixer) {
    const vol = track.mixer.volume;
    const target = vol.min + (vol.max - vol.min) * 0.85;
    await vol.setValue(target);
  }

  for (const device of track.devices) {
    if (!(device instanceof Device)) continue;
    const reverbParam = device.parameters.find((p) =>
      REVERB_PARAM_NAMES.some((name) => p.name.includes(name)),
    );
    if (reverbParam) {
      const mid = (reverbParam.min + reverbParam.max) / 2;
      await reverbParam.setValue(mid);
      break;
    }
  }
}

export async function setTrackVolume(track: AudioTrack<"1.0.0">, level: number): Promise<void> {
  if (track.mixer) {
    const vol = track.mixer.volume;
    const target = vol.min + (vol.max - vol.min) * level;
    await vol.setValue(target);
  }
}

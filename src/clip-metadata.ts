/** Live clip colors as 24-bit RGB integers. */
export const FEATURE_COLORS: Record<string, number> = {
  tts: 0x3d5afe,
  dialogue: 0x7c4dff,
  sfx: 0xff6d00,
  music: 0x00c853,
  inpaint: 0x00bfa5,
  voice: 0xec407a,
  isolation: 0x26c6da,
  stem: 0x8d6e63,
};

export function featureColor(feature: string): number {
  return FEATURE_COLORS[feature] ?? 0x607d8b;
}

/** Prefix generated clips so they are recognizable in the arrangement. */
export function clipNameFor(feature: string, detail: string): string {
  const cleaned = detail.replace(/\s+/g, " ").trim();
  const raw = cleaned ? `EL ${feature}: ${cleaned}` : `EL ${feature}`;
  return raw.length > 60 ? `${raw.slice(0, 57)}...` : raw;
}

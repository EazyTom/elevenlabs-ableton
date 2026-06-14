/** Split comma/semicolon/newline-separated negation terms. */
export function parseNegativePromptTerms(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** ElevenLabs text-to-SFX API maximum prompt length (HTTP 400 if exceeded). */
export const SFX_TEXT_MAX_LENGTH = 450;

/** SFX API has no negative-prompt field — append an avoid clause to the text prompt. */
export function buildSfxApiText(text: string, negativePrompt?: string): string {
  const base = text.trim();
  const terms = parseNegativePromptTerms(negativePrompt);
  if (terms.length === 0) return base;
  return `${base}. Avoid: ${terms.join(", ")}`;
}

/** Trim the descriptive prefix so the full SFX prompt (incl. avoid clause) fits the API limit. */
export function clampSfxApiText(
  text: string,
  negativePrompt?: string,
  maxLength = SFX_TEXT_MAX_LENGTH,
): string {
  let result = buildSfxApiText(text, negativePrompt);
  if (result.length <= maxLength) return result;

  const terms = parseNegativePromptTerms(negativePrompt);
  const avoidSuffix = terms.length > 0 ? `. Avoid: ${terms.join(", ")}` : "";
  let maxBaseLength = maxLength - avoidSuffix.length;
  if (maxBaseLength < 1) return result.slice(0, maxLength);

  let base = text.trim().slice(0, maxBaseLength).trimEnd();
  const lastComma = base.lastIndexOf(",");
  if (lastComma > maxBaseLength * 0.4) {
    base = base.slice(0, lastComma).trimEnd();
  }
  result = buildSfxApiText(base, negativePrompt);
  return result.length > maxLength ? result.slice(0, maxLength) : result;
}

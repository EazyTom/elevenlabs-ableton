/** Split comma/semicolon/newline-separated negation terms. */
export function parseNegativePromptTerms(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** SFX API has no negative-prompt field — append an avoid clause to the text prompt. */
export function buildSfxApiText(text: string, negativePrompt?: string): string {
  const base = text.trim();
  const terms = parseNegativePromptTerms(negativePrompt);
  if (terms.length === 0) return base;
  return `${base}. Avoid: ${terms.join(", ")}`;
}

export interface SfxPromptBanks {
  readonly textures: readonly string[];
  readonly cores: readonly string[];
  readonly details: readonly string[];
  readonly motion: readonly string[];
  readonly contexts: readonly string[];
}

export const SFX_PROMPT_BANKS: SfxPromptBanks = {
  textures: [
    "spacious",
    "gritty",
    "silky",
    "metallic",
    "muffled",
    "brittle",
    "warm",
    "icy",
    "granular",
    "punchy",
  ],
  cores: [
    "impact hit",
    "whoosh",
    "rumble",
    "crackle",
    "chime",
    "scrape",
    "pulse",
    "hiss",
    "thud",
    "shimmer",
    "braam",
    "riser",
  ],
  details: [
    "sharp transients",
    "wide stereo spread",
    "subtle room reverb",
    "heavy compression",
    "soft attack",
    "vinyl noise",
    "short decay",
    "layered harmonics",
  ],
  motion: [
    "rising slowly",
    "stuttering rhythmically",
    "swelling then fading",
    "short decay",
    "building tension",
    "cascading downward",
  ],
  contexts: [
    "cinematic trailer impacts",
    "lo-fi beat production",
    "horror game ambience",
    "UI button feedback",
    "podcast transitions",
    "dance floor energy",
    "documentary underscore",
    "mobile game reward moments",
  ],
};

export const SFX_LOOP_SUFFIX = ", designed to loop seamlessly";

/** JSON string for injection into SFX modal HTML. */
export const SFX_PROMPT_BANKS_JSON = JSON.stringify(SFX_PROMPT_BANKS);

type PromptParts = {
  texture: string;
  core: string;
  detail: string;
  motion: string;
  context: string;
};

function pick<T>(items: readonly T[], random = Math.random): T {
  return items[Math.floor(random() * items.length)]!;
}

function buildParts(banks: SfxPromptBanks, random = Math.random): PromptParts {
  return {
    texture: pick(banks.textures, random),
    core: pick(banks.cores, random),
    detail: pick(banks.details, random),
    motion: pick(banks.motion, random),
    context: pick(banks.contexts, random),
  };
}

const TEMPLATES: readonly ((parts: PromptParts) => string)[] = [
  (p) => `${p.texture} ${p.core} with ${p.detail}, suitable for ${p.context}`,
  (p) => `${p.texture} ${p.core} ${p.motion}, ideal for ${p.context}`,
  (p) => `Close-mic ${p.core} with ${p.detail} and ${p.texture} character, for ${p.context}`,
];

/** Build a random descriptive SFX prompt in ElevenLabs style. */
export function randomSfxPrompt(
  options?: { loop?: boolean; banks?: SfxPromptBanks },
  random = Math.random,
): string {
  const banks = options?.banks ?? SFX_PROMPT_BANKS;
  const parts = buildParts(banks, random);
  const template = pick(TEMPLATES, random);
  let prompt = template(parts);
  if (options?.loop) {
    prompt += SFX_LOOP_SUFFIX;
  }
  return prompt;
}

/** Inline script injected into SFX modals (runs in Live webview). */
export function buildSfxPromptRandomizerScript(): string {
  return `<script>
const SFX_PROMPT_BANKS = ${SFX_PROMPT_BANKS_JSON};
const SFX_LOOP_SUFFIX = ${JSON.stringify(SFX_LOOP_SUFFIX)};

function buildRandomSfxPrompt(banks, loop) {
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const parts = {
    texture: pick(banks.textures),
    core: pick(banks.cores),
    detail: pick(banks.details),
    motion: pick(banks.motion),
    context: pick(banks.contexts),
  };
  const templates = [
    (p) => p.texture + " " + p.core + " with " + p.detail + ", suitable for " + p.context,
    (p) => p.texture + " " + p.core + " " + p.motion + ", ideal for " + p.context,
    (p) => "Close-mic " + p.core + " with " + p.detail + " and " + p.texture + " character, for " + p.context,
  ];
  let prompt = pick(templates)(parts);
  if (loop) prompt += SFX_LOOP_SUFFIX;
  return prompt;
}

function randomizePrompt() {
  const loop = document.getElementById("loop").checked;
  document.getElementById("text").value = buildRandomSfxPrompt(SFX_PROMPT_BANKS, loop);
  document.getElementById("text").focus();
}
</script>`;
}

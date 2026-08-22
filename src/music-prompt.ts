import type { MusicModalResult } from "./types.js";

const GENRE_PHRASES: Record<string, string> = {
  trap: "trap",
  house: "house",
  techno: "techno",
  ambient: "ambient electronic",
  dnb: "drum and bass",
  dubstep: "dubstep",
  hipHop: "hip hop",
  epic: "epic cinematic",
  horror: "dark cinematic horror",
  documentary: "documentary cinematic",
  atmospheric: "atmospheric cinematic",
  sciFi: "sci-fi cinematic",
  bollywood: "bollywood cinematic",
  country: "country",
  bluegrass: "bluegrass",
  jazz: "jazz",
  classical: "classical",
  ambientMusic: "ambient",
  jungle: "jungle",
  rock90s: "90s rock",
  disco: "disco",
  folk: "folk",
  retro80s: "80s retro",
  indie90s: "90s indie",
  acoustic: "acoustic",
  dark: "dark",
  loFi: "lo-fi",
  instrumental: "instrumental",
  phonk: "phonk",
  synthwave: "synthwave",
  reggae: "reggae",
  soul: "soul",
  rnb: "R&B",
  metal: "metal",
  latin: "latin",
  industrial: "industrial",
  gospel: "gospel",
  punk: "punk",
  blues: "blues",
  afrobeats: "afrobeats",
  grime: "grime",
  ukGarage: "UK garage",
  grunge: "grunge",
  kpop: "K-pop",
  celtic: "celtic",
  meditation: "meditation",
  nuDisco: "nu-disco",
  trance: "trance",
  psytrance: "psytrance",
  electro: "electro",
  neuro: "neurofunk",
};

export function musicForceInstrumental(modal: MusicModalResult): boolean {
  return modal.genres?.includes("instrumental") ?? false;
}

/** Merge modal genres, tempo, key/scale, and free text into one ElevenLabs music prompt. */
export function buildMusicPrompt(
  modal: MusicModalResult,
  songContext?: { rootNote?: number; scaleName?: string },
): string {
  const parts: string[] = [];

  for (const key of modal.genres ?? []) {
    const phrase = GENRE_PHRASES[key];
    if (phrase) parts.push(phrase);
  }

  if (modal.tempoBpm !== undefined && modal.tempoBpm >= 40 && modal.tempoBpm <= 200) {
    parts.push(`${Math.round(modal.tempoBpm)} BPM`);
  }

  if (songContext?.rootNote !== undefined && Number.isFinite(songContext.rootNote)) {
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const name = noteNames[((Math.round(songContext.rootNote) % 12) + 12) % 12];
    if (name) {
      const scale = songContext.scaleName?.trim();
      parts.push(scale ? `${name} ${scale.toLowerCase()}` : name);
    }
  }

  if (modal.prompt?.trim()) parts.push(modal.prompt.trim());

  return parts.join(", ") || "electronic music";
}

const MIN_SECTION_MS = 3_000;
const MAX_SECTION_MS = 120_000;

function musicSectionsForDuration(durationMs: number): Array<{
  sectionName: string;
  positiveLocalStyles: string[];
  negativeLocalStyles: string[];
  durationMs: number;
  lines: string[];
}> {
  const total = Math.max(MIN_SECTION_MS, durationMs);
  const sectionCount = Math.ceil(total / MAX_SECTION_MS);
  const sectionDuration = Math.ceil(total / sectionCount);

  return Array.from({ length: sectionCount }, (_, index) => ({
    sectionName: sectionCount === 1 ? "Main" : `Section ${index + 1}`,
    positiveLocalStyles: [] as string[],
    negativeLocalStyles: [] as string[],
    durationMs: sectionDuration,
    lines: [] as string[],
  }));
}

/** Build a music_v1 composition plan when the user supplies negative styles. */
export function buildMusicV1CompositionPlan(
  positivePrompt: string,
  negativeTerms: string[],
  durationMs: number,
  options?: { forceInstrumental?: boolean },
): {
  positiveGlobalStyles: string[];
  negativeGlobalStyles: string[];
  sections: ReturnType<typeof musicSectionsForDuration>;
} {
  const positiveStyles = positivePrompt
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const negativeStyles = [...negativeTerms];
  if (options?.forceInstrumental) {
    for (const term of ["vocals", "singing", "lyrics"]) {
      if (!negativeStyles.includes(term)) negativeStyles.push(term);
    }
  }

  return {
    positiveGlobalStyles: positiveStyles.length ? positiveStyles : ["electronic music"],
    negativeGlobalStyles: negativeStyles,
    sections: musicSectionsForDuration(durationMs),
  };
}

/** Build a music_v2 chunk plan when the user supplies negative styles. */
export function buildMusicV2CompositionPlan(
  positivePrompt: string,
  negativeTerms: string[],
  durationMs: number,
  options?: { forceInstrumental?: boolean },
): {
  chunks: Array<{
    text: string;
    durationMs: number;
    positiveStyles: string[];
    negativeStyles: string[];
    contextAdherence: "high";
  }>;
} {
  const positiveStyles = positivePrompt
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  const negativeStyles = [...negativeTerms];
  if (options?.forceInstrumental) {
    for (const term of ["vocals", "singing", "lyrics"]) {
      if (!negativeStyles.includes(term)) negativeStyles.push(term);
    }
  }

  const styles = positiveStyles.length ? positiveStyles : ["electronic music"];
  const sections = musicSectionsForDuration(durationMs);

  return {
    chunks: sections.map((section) => ({
      text: `[${section.sectionName}]`,
      durationMs: section.durationMs,
      positiveStyles: styles,
      negativeStyles,
      contextAdherence: "high" as const,
    })),
  };
}

/** @deprecated Use buildMusicV1CompositionPlan — kept for tests referencing snake_case REST shape. */
export function buildMusicCompositionPlan(
  positivePrompt: string,
  negativeTerms: string[],
  durationMs: number,
  options?: { forceInstrumental?: boolean },
): Record<string, unknown> {
  const plan = buildMusicV1CompositionPlan(positivePrompt, negativeTerms, durationMs, options);
  return {
    positive_global_styles: plan.positiveGlobalStyles,
    negative_global_styles: plan.negativeGlobalStyles,
    sections: plan.sections.map((s) => ({
      section_name: s.sectionName,
      positive_local_styles: s.positiveLocalStyles,
      negative_local_styles: s.negativeLocalStyles,
      duration_ms: s.durationMs,
      lines: s.lines,
    })),
  };
}

export interface MusicPromptBanks {
  readonly genres: readonly string[];
  readonly instruments: readonly string[];
  readonly moods: readonly string[];
  readonly structures: readonly string[];
  readonly contexts: readonly string[];
  readonly textures: readonly string[];
  readonly production: readonly string[];
  readonly cinematic: readonly string[];
}

export const MUSIC_PROMPT_BANKS: MusicPromptBanks = {
  genres: [
    // Electronic — club & bass
    "dark trap with sliding 808 glides, rattling hi-hat triplets, and sub-rumble tail",
    "deep house with rolling bass pump, filtered chord stabs, and open-hat shuffle",
    "peak-time techno with rumbling kick pressure, acid squelch lines, and ride wash",
    "ambient electronic with drifting pad clouds, granular swells, and distant bell pings",
    "liquid drum and bass with shimmering breakbeats, Reese bass wobble, and splash cymbals",
    "modern dubstep with wobble bass LFOs, half-time snare cracks, and sub drop weight",
    "boom-bap hip hop with dusty kick thump, vinyl crackle, and sampled Rhodes stabs",
    "UK garage with skippy two-step drums, chopped vocal chops, and warm sub bass",
    "grime with square-wave bass stabs, rattling snare rolls, and sparse synth bleeps",
    "electro with squelchy 808 claps, talkbox lead lines, and syncopated bass glides",
    "nu-disco with funky octave bass, string stab hits, and four-on-the-floor kick pump",
    "trance with gated supersaw stacks, rolling kick drive, and arpeggiated lead sweeps",
    "psytrance with squelchy acid lines, rolling kick pulse, and triplet hi-hat chatter",
    "neurofunk with reese bass growls, tight snare transients, and glitchy edit fills",
    "phonk with distorted 808 cowbells, Memphis-style chops, and tape-saturated drums",
    "synthwave with gated snare reverb, DX7 bell arps, and Juno pad swells",
    "industrial with metallic percussion hits, distorted kick thuds, and noise bursts",
    // Cinematic
    "epic orchestral build with brass fanfare blasts, timpani rolls, and string tremolo swells",
    "atmospheric cinematic soundscape with evolving drone beds and distant thunder rumbles",
    "horror underscore with dissonant string scrapes, metallic clang hits, and low drone pulse",
    "documentary score with restrained piano hammer taps and subtle pulse bass throb",
    "sci-fi cinematic with glassy synth pings, vast reverb tails, and sub harmonic bloom",
    "Bollywood cinematic with tabla groove patterns, sitar bends, and soaring string lines",
    // Traditional & acoustic
    "modern country with twangy telecaster chicken-pick, brushed snare swish, and pedal steel gliss",
    "bluegrass picking session with banjo roll flurries, mandolin tremolo, and upright bass thump",
    "smoky late-night jazz trio with ride cymbal wash, walking bass plucks, and muted trumpet puffs",
    "intimate neoclassical strings with bow scrape swells, pizzicato plucks, and soft pedal bloom",
    "celtic folk with uilleann pipe drones, bodhrán frame hits, and fiddle reel runs",
    "acoustic folk with fingerpicked guitar patterns, harmonica breath swells, and foot-tap rhythm",
    // Rock & alternative
    "90s alternative rock with crunchy power-chord riffs, live room snare crack, and bass fuzz growl",
    "grunge with detuned guitar churn, room mic drum smack, and bass feedback rumble",
    "distorted metal with palm-muted chug riffs, double-kick flurries, and screaming lead harmonics",
    "90s indie with jangly clean guitar arpeggios, loose snare rattle, and warm room ambience",
    "punk with downstroke power-chord barrage, fast hi-hat sizzle, and shouted vocal rawness",
    // Pop, soul & global
    "four-on-the-floor disco with funky slap bass pops, string stab hits, and open hi-hat sizzle",
    "80s retro synth-pop with gated snare reverb, DX7 bell tones, and LinnDrum punch",
    "K-pop with stacked vocal hooks, tight kick-snare pocket, and bright synth lead stabs",
    "soul with warm Rhodes chord stabs, brushed snare shuffle, and horn section blasts",
    "R&B with silky electric piano chords, 808 kick thump, and layered vocal harmonies",
    "reggae with one-drop kick pattern, skank guitar chops, and dub delay feedback tails",
    "latin with conga slap patterns, montuno piano tumbao, and brass section hits",
    "afrobeats with log drum patterns, shakers, and bright guitar pluck riffs",
    "gospel with organ swell pedals, clap stacks, and choir call-and-response lifts",
    "blues with bent guitar licks, shuffle snare swing, and walking bass plucks",
    // Ambient & focus
    "meditative ambient with slow-evolving pad drones, singing bowl overtones, and breath-like swells",
    "meditation soundscape with soft chime pings, low-frequency om drones, and gentle wind textures",
    "lo-fi beat with vinyl crackle hiss, muffled kick thump, and warbly tape-wow keys",
    "dark electronic with minor-key pad drones, sub rumble pulses, and sparse metallic pings",
    "instrumental bed with muted piano motifs, soft string pads, and no vocal presence",
    "jungle breakbeat track with chopped amen fills, sub pressure waves, and ragga vocal snippets",
  ],
  instruments: [
    "analog synth pads with slow filter sweeps and stereo chorus width",
    "808 kick thumps with crisp trap hi-hat rolls and rimshot accents",
    "live string section with tremolo bow swells and pizzicato plucks",
    "warm Rhodes chord stabs and mellow Wurlitzer tremolo layers",
    "acoustic guitar fingerpicking with open-string resonance and body thump",
    "tabla bols and sitar bend slides with sympathetic string buzz",
    "distorted power-chord stacks and overdriven bass fuzz growl",
    "upright bass plucks, brushed snare swish, and muted trumpet puffs",
    "orchestral brass stabs and taiko-style drum ensemble hits",
    "modular synth bleeps, tape-saturated keys, and ring-mod textures",
    "banjo roll flurries, mandolin tremolo, and fiddle double-stop runs",
    "four-on-the-floor kick with syncopated clap stacks and open hi-hat sizzle",
    "glitchy granular fragments and sub-heavy sine bass pressure",
    "stacked vocal pad harmonies with formant-filter sweeps",
    "funky wah guitar sweeps and slap bass pops with string rattle",
    "supersaw lead stacks with portamento glide and sidechain ducking",
    "talkbox lead lines with envelope-filtered bass squelch",
    "bodhrán frame hits, uilleann pipe drones, and tin whistle trills",
    "singing bowl overtones with soft chime pings and breath pad swells",
    "Memphis-style chopped vocal stabs with distorted cowbell accents",
  ],
  moods: [
    "soaring hook lifts with wide chorus bloom and stacked octave leads",
    "minor-key chord droops with soft reverb tail decay and muted dynamics",
    "hypnotic pulse lock with rolling kick drive and filter sweep hypnosis",
    "peak-time kick pressure with supersaw stack surges and snare rush fills",
    "tense staccato string plucks with ticking percussion and low drone pulse",
    "slow-attack pad swells with long tail bloom and distant bell pings",
    "punchy transient hits with clipped decays and in-your-face midrange bite",
    "vinyl-worn nostalgia with tape hiss, wow flutter, and muffled top end",
    "weightless high-frequency shimmer with airy reverb wash and soft dynamics",
    "brooding sub-rumble pulses with sparse metallic pings and dark pad drones",
    "syncopated bounce with offbeat bass plucks and playful hi-hat chatter",
    "close-mic intimacy with finger noise, breath sounds, and soft hammer taps",
    "brass fanfare ascents with timpani roll crescendos and cymbal crash peaks",
    "dissonant cluster scrapes with metallic clang hits and sub harmonic rumble",
    "sun-drenched open chords with bright top-end sparkle and loose groove swing",
    "nocturnal sub-bass pressure with reverb-drenched snare tails and moody pad drones",
  ],
  structures: [
    "steady four-on-the-floor kick with filter sweep builds every sixteen bars",
    "slow riser swell into a sub drop hit and second-act lead lift",
    "minimal arrangement with generous silence gaps and sparse percussion hits",
    "layered texture stacks that mutate every eight bars with new timbre entries",
    "syncopated groove with swung hi-hat shuffle and offbeat bass pluck patterns",
    "sparse intro with single element bloom into full ensemble wall-of-sound climax",
    "verse-chorus arc with breakdown strip-back and final double-chorus stack lift",
    "through-composed cue with three distinct timbre shifts and tempo-locked transitions",
    "loop-friendly eight-bar phrase with clear downbeat kick and tail fade point",
    "call-and-response between lead melody hits and rhythm section accent replies",
    "gradual tempo ramp with kick density increase into high-energy finale burst",
    "half-time switch with snare crack weight and bass sub drop on the downbeat",
    "build-drop-build pattern with white-noise riser sweeps and impact hit accents",
  ],
  contexts: [
    "late-night highway reverb tails and distant headlight synth pings",
    "HIIT interval drops with punchy kick flurries and snare accent hits",
    "film underscore beds with subtle pulse bass throb and evolving pad drones",
    "game exploration loops with ambient pad swells and soft percussion ticks",
    "breathwork sessions with om drone beds and gentle chime overtones",
    "runway strut grooves with tight kick-snare pocket and bass pump drive",
    "podcast intro stabs with short impact hits and clean tail decay",
    "club peak-time sub pressure zones with rolling kick drive and hat chatter",
    "documentary montage pulse beds with restrained piano motifs and soft strings",
    "indie film credits with jangly guitar arpeggios and room mic ambience",
    "trailer impact moments with riser sweeps, hit accents, and sub drop weight",
    "coffee-shop background loops with muffled kick thump and vinyl crackle hiss",
    "yoga flow sequences with singing bowl pings and slow pad bloom swells",
    "sports highlight stingers with brass blast hits and percussion ensemble drive",
    "neon cityscape synth arps with gated snare reverb and bass pump pulse",
    "warehouse rave sub-rumble zones with acid squelch lines and strobe-synced builds",
  ],
  textures: [
    "tape-warped saturation hiss with soft top-end roll-off",
    "pinging high-end shimmer with brittle crystalline transients",
    "gritty lo-fi crunch with bit-reduced sample artifacts",
    "lush wide-stereo chorus spread with doubled octave layers",
    "dry upfront punch with tight transient snap and minimal reverb",
    "spacious hall reverb wash with long tail decay and distant reflections",
    "glitchy stutter fragments with granular spray and digital crackle",
    "organic acoustic body resonance with room mic bleed and finger noise",
    "shimmering high-frequency sparkle with air band lift and harmonic bloom",
    "dark sub-heavy pressure with muffled mids and rumble tail weight",
    "bright polished sheen with crisp transients and scooped low-mid clarity",
    "dusty vinyl-worn crackle with wow flutter and muffled frequency roll-off",
    "sidechain-pumped ducking swell with breathing bass pump rhythm",
    "metallic clang resonance with ring-mod artifacts and harsh upper harmonics",
    "warm analog drift with subtle detune chorusing and tape compression glue",
  ],
  production: [
    "sidechain pumping ducking on bass and pads with kick-triggered swell",
    "subtle tape wow and flutter on keys with saturation warmth",
    "parallel compressed drums with punchy transient snap and sustained body",
    "wide stereo chorus spread on synth pads with doubled octave layers",
    "room mic bleed blending for live ensemble smack and air movement",
    "filtered intro sweep builds into full-frequency drop release",
    "vinyl crackle hiss and tape noise bed under the mix foundation",
    "tight punchy kick transients with scooped low-mid mud clearance",
    "long plate reverb tails on lead lines with pre-delay separation",
    "automation-heavy filter sweeps with resonance peak builds",
    "stacked octave guitar layers for stereo width and harmonic density",
    "gentle master bus saturation glue with soft clip rounding",
    "multiband sidechain on sub bass with kick frequency ducking",
    "reverse reverb swell pre-hits before snare crack accents",
    "distorted parallel drum bus for grit layer under clean mix",
  ],
  cinematic: [
    "trailer impact hit accents with sub drop weight and riser sweep builds",
    "slow-burn documentary pulse beds with restrained piano hammer taps",
    "Bollywood emotional string swell crescendos with tabla groove underpins",
    "sci-fi vastness with glassy synth pings and cosmic reverb tail wash",
    "horror stinger accents with dissonant cluster scrapes and low drone pulse",
    "heroic brass ascent fanfares with timpani roll crescendo peaks",
    "intimate close-mic piano storytelling with pedal bloom and hammer noise",
    "epic percussion ensemble drive with taiko hits and cymbal crash swells",
    "atmospheric bed drones with subtle pulse bass throb underneath",
    "suspenseful ticking percussion with staccato string pluck accents",
    "slow-motion reveal swells with reverse cymbal builds and sub harmonic bloom",
    "action sequence drive with staccato brass stabs and rapid percussion flurries",
  ],
};

export const MUSIC_LOOP_SUFFIX = ", designed to loop seamlessly for production use";

export const MUSIC_TEMPLATE_STRINGS: readonly string[] = [
  "{genre}, {instruments}, {texture}, {structure}, for {context}",
  "{genre} featuring {instruments}, {mood}, {production}, {structure}",
  "{cinematic} {genre} with {instruments}, {texture}, suited for {context}",
  "{texture} {genre} built around {instruments}, {structure}, {mood}",
  "instrumental {genre}, {instruments}, {production}, for {context}",
  "{genre} with {instruments} and {structure}, {cinematic} throughout",
  "{production} {genre}, {instruments}, {mood}, for {context}",
  "{cinematic}: {genre}, {instruments}, {texture}, {structure}",
  "{genre} cue with {instruments}, {structure}, {production}, {mood}",
  "{genre} arrangement using {instruments}, {texture}, for {context}",
  "{texture} {genre}, {instruments}, {cinematic}, {structure}",
  "{genre} track with {instruments}, {production}, {mood}, for {context}",
];

export const MUSIC_PROMPT_BANKS_JSON = JSON.stringify(MUSIC_PROMPT_BANKS);
export const MUSIC_TEMPLATE_STRINGS_JSON = JSON.stringify(MUSIC_TEMPLATE_STRINGS);

type MusicPromptParts = {
  genre: string;
  instruments: string;
  mood: string;
  structure: string;
  context: string;
  texture: string;
  production: string;
  cinematic: string;
};

function pickMusic<T>(items: readonly T[], random = Math.random): T {
  return items[Math.floor(random() * items.length)]!;
}

function buildMusicParts(banks: MusicPromptBanks, random = Math.random): MusicPromptParts {
  return {
    genre: pickMusic(banks.genres, random),
    instruments: pickMusic(banks.instruments, random),
    mood: pickMusic(banks.moods, random),
    structure: pickMusic(banks.structures, random),
    context: pickMusic(banks.contexts, random),
    texture: pickMusic(banks.textures, random),
    production: pickMusic(banks.production, random),
    cinematic: pickMusic(banks.cinematic, random),
  };
}

function applyMusicTemplate(template: string, parts: MusicPromptParts): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => parts[key as keyof MusicPromptParts] ?? "");
}

/** Build a random descriptive music prompt in ElevenLabs style. */
export function randomMusicPrompt(
  options?: { loop?: boolean; banks?: MusicPromptBanks },
  random = Math.random,
): string {
  const banks = options?.banks ?? MUSIC_PROMPT_BANKS;
  const parts = buildMusicParts(banks, random);
  const template = pickMusic(MUSIC_TEMPLATE_STRINGS, random);
  let prompt = applyMusicTemplate(template, parts);
  if (options?.loop) {
    prompt += MUSIC_LOOP_SUFFIX;
  }
  return prompt;
}

/** Inline script injected into the music modal (runs in Live webview). */
export function buildMusicPromptRandomizerScript(): string {
  return `<script>
const MUSIC_PROMPT_BANKS = ${MUSIC_PROMPT_BANKS_JSON};
const MUSIC_TEMPLATE_STRINGS = ${MUSIC_TEMPLATE_STRINGS_JSON};
const MUSIC_LOOP_SUFFIX = ${JSON.stringify(MUSIC_LOOP_SUFFIX)};

function buildRandomMusicPrompt(banks, loop) {
  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  const parts = {
    genre: pick(banks.genres),
    instruments: pick(banks.instruments),
    mood: pick(banks.moods),
    structure: pick(banks.structures),
    context: pick(banks.contexts),
    texture: pick(banks.textures),
    production: pick(banks.production),
    cinematic: pick(banks.cinematic),
  };
  const template = pick(MUSIC_TEMPLATE_STRINGS);
  let prompt = template.replace(/\\{(\\w+)\\}/g, (_, key) => parts[key] || "");
  if (loop) prompt += MUSIC_LOOP_SUFFIX;
  return prompt;
}

function randomizePrompt() {
  const loop = document.getElementById("loop").checked;
  document.getElementById("prompt").value = buildRandomMusicPrompt(MUSIC_PROMPT_BANKS, loop);
  document.getElementById("prompt").focus();
}
</script>`;
}

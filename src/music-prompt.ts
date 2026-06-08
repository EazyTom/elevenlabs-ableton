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
};

/** Merge modal toggles, genres, tempo, and free text into one ElevenLabs music prompt. */
export function buildMusicPrompt(modal: MusicModalResult): string {
  const parts: string[] = [];

  for (const key of modal.genres ?? []) {
    const phrase = GENRE_PHRASES[key];
    if (phrase) parts.push(phrase);
  }

  if (modal.tempoBpm !== undefined && modal.tempoBpm >= 40 && modal.tempoBpm <= 200) {
    parts.push(`${Math.round(modal.tempoBpm)} BPM`);
  }

  if (modal.highEnergy) parts.push("high energy");
  if (modal.darkMood) parts.push("dark moody");
  if (modal.loFi) parts.push("lo-fi");

  if (modal.prompt?.trim()) parts.push(modal.prompt.trim());

  return parts.join(", ") || "electronic music";
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
    // Electronic
    "dark trap with sliding 808s and sparse hi-hats",
    "deep house with rolling bass and filtered chord stabs",
    "peak-time techno with rumbling kick and acid squelch",
    "ambient electronic with drifting pads and granular swells",
    "liquid drum and bass with shimmering breakbeats and Reese bass",
    "modern dubstep with wobble bass and half-time drops",
    "boom-bap hip hop with dusty drums and sampled Rhodes",
    // Cinematic
    "epic orchestral build with brass fanfares and timpani rolls",
    "atmospheric cinematic soundscape with evolving drones",
    "horror underscore with dissonant strings and metallic scrapes",
    "documentary score with restrained piano and subtle pulse",
    "sci-fi cinematic with glassy synths and vast reverb tails",
    "Bollywood cinematic with tabla grooves and soaring string lines",
    // Traditional
    "modern country with twangy telecaster and brushed snare",
    "bluegrass picking session with banjo rolls and upright bass",
    "smoky late-night jazz trio with ride cymbal and walking bass",
    "intimate neoclassical strings with delicate dynamic swells",
    // Music genre
    "meditative ambient with slow-evolving harmonic clouds",
    "jungle breakbeat track with chopped amen rhythms and sub pressure",
    "90s alternative rock with crunchy guitars and live room drums",
    "four-on-the-floor disco with funky bass and string stabs",
    "acoustic folk with fingerpicked guitar and harmonica accents",
    "80s retro synthwave with gated snares and DX7 bell tones",
    "90s indie with jangly guitars and warm lo-fi room ambience",
  ],
  instruments: [
    "analog synth pads and arpeggiated sequences",
    "808 kick and crisp trap hi-hat patterns",
    "live string section with tremolo and pizzicato",
    "warm Rhodes chords and mellow Wurlitzer layers",
    "acoustic guitar fingerpicking and open tunings",
    "tabla and sitar-inflected melodic motifs",
    "distorted power chords and overdriven bass",
    "upright bass, brushed drums, and muted trumpet",
    "orchestral brass stabs and taiko-style percussion",
    "modular synth textures and tape-saturated keys",
    "banjo, mandolin, and fiddle countermelodies",
    "four-on-the-floor kick with syncopated claps",
    "glitchy granular textures and sub-heavy bass",
    "choir-like vocal pads and stacked harmonies",
    "funky wah guitar and slap bass lines",
  ],
  moods: [
    "uplifting and anthemic",
    "melancholic yet hopeful",
    "hypnotic and trance-inducing",
    "euphoric peak-time energy",
    "tense and suspenseful",
    "dreamy and otherworldly",
    "aggressive and in-your-face",
    "nostalgic and bittersweet",
    "ethereal and weightless",
    "brooding and cinematic",
    "playful and quirky",
    "intimate and confessional",
    "triumphant and heroic",
    "eerie and unsettling",
    "sun-drenched and carefree",
    "nocturnal and moody",
  ],
  structures: [
    "steady four-on-the-floor groove with subtle filter sweeps",
    "slow build with a dramatic drop and second-act lift",
    "minimal arrangement with generous negative space",
    "layered textures that evolve every eight bars",
    "syncopated rhythm with swung hi-hats and offbeat bass",
    "sparse intro leading to a full ensemble climax",
    "verse-chorus arc with a breakdown and final double chorus",
    "through-composed film cue with three distinct movements",
    "loop-friendly eight-bar phrase with clear downbeat",
    "call-and-response between lead and rhythm sections",
    "gradual tempo ramp into a high-energy finale",
  ],
  contexts: [
    "late-night highway driving",
    "workout and fitness playlists",
    "film and TV underscore",
    "game menu and exploration screens",
    "meditation and focus sessions",
    "fashion runway and lookbook edits",
    "podcast intro and outro beds",
    "club peak-time and festival main stage",
    "documentary montage sequences",
    "indie film opening credits",
    "trailer impact and reveal moments",
    "coffee-shop background listening",
    "yoga and wellness content",
    "sports highlight reels",
    "retro arcade and neon cityscapes",
  ],
  textures: [
    "warm and tape-saturated",
    "icy and crystalline",
    "gritty and lo-fi",
    "lush and wide-stereo",
    "dry and upfront",
    "spacious and reverberant",
    "glitchy and fragmented",
    "organic and acoustic-forward",
    "shimmering and high-frequency rich",
    "dark and sub-heavy",
    "bright and polished",
    "dusty and vinyl-worn",
  ],
  production: [
    "sidechain pumping on the bass",
    "subtle tape wow and flutter",
    "parallel compression on drums",
    "wide chorus on synth pads",
    "room mic bleed for live feel",
    "filtered intro sweeps into the drop",
    "vinyl crackle and tape hiss accents",
    "tight punchy transients on the kick",
    "long plate reverb tails on leads",
    "automation-heavy filter movement",
    "stacked octave guitars for width",
    "gentle saturation on the master bus",
  ],
  cinematic: [
    "trailer-style impact hits and risers",
    "slow-burn documentary pacing",
    "Bollywood emotional string swell",
    "sci-fi vastness and cosmic scale",
    "horror stinger accents and drones",
    "heroic brass ascent into the climax",
    "intimate close-mic piano storytelling",
    "epic percussion ensemble drive",
    "atmospheric bed with subtle pulse",
    "suspenseful ticking-clock tension",
  ],
};

export const MUSIC_LOOP_SUFFIX = ", designed to loop seamlessly for production use";

export const MUSIC_TEMPLATE_STRINGS: readonly string[] = [
  "{mood} {genre}, {instruments}, {texture} mix, {structure}, for {context}",
  "{genre} featuring {instruments}, {mood} tone, {production}, {structure}",
  "{cinematic} {genre} with {instruments}, {texture} character, suited for {context}",
  "{texture} {genre} built around {instruments}, {structure}, {mood} feel",
  "{mood} instrumental in a {genre} style, {instruments}, {production}, for {context}",
  "{genre} with {instruments} and {structure}, {cinematic} undertones throughout",
  "{production}-forward {genre}, {instruments}, {mood} energy, ideal for {context}",
  "{cinematic} piece: {genre}, {instruments}, {texture} palette, {structure}",
  "{mood} {genre} cue with {instruments}, {structure}, {production}",
  "{genre} arrangement using {instruments}, {texture} production, for {context}",
  "{mood} and {texture} {genre}, {instruments}, {cinematic} flavor, {structure}",
  "{genre} track with {instruments}, {production}, {mood} mood for {context}",
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

// Chog traits -> sound. Deterministic: the same traits always give the same
// sound, and every Chog gets a complete sound with no missing parts.
//
// Everything tweakable lives in the tables at the top of this file.
//
// Keyword matching rule (used by every keyword table): a value matches a
// keyword when one of its words STARTS WITH that keyword, ignoring case.
// So "stripe" matches "Stripe Shirt", "Stripe shirts" and "Stripes", and
// "cry" matches "Round Crying", but "mon" does NOT match "Lemon".
// Multi-word keywords ("red sky") must match consecutive words.
// Tables are checked top to bottom; the first group with a match wins.
//
// This file has no audio code. lib/engine.ts turns a ChogSound into Tone.js
// nodes using the numbers in the tables below.

// ---------------------------------------------------------------------------
// 1. Skin -> band role
// ---------------------------------------------------------------------------
// Base can't decide roles: 94.9% of Chogs are "Origin". Skin splits ~28/27/28/16.
// Any Skin not listed here (Yellow and every rare skin) plays drums.

export type Role = "drums" | "bass" | "chords" | "melody";

export const SKIN_ROLE: Record<string, Role> = {
  Pink: "melody", // 557
  Origin: "chords", // 528
  Red: "bass", // 299
  Black: "bass", // 263
};
export const SKIN_ROLE_FALLBACK: Role = "drums"; // Yellow 246 + rare skins 66

// ---------------------------------------------------------------------------
// 2. Base -> flavour   (Form "Skull" is always Base "Skull", so Base alone decides)
// ---------------------------------------------------------------------------

export type Flavour = "none" | "spooky" | "glitch";

export const BASE_FLAVOUR: Record<string, Flavour> = {
  Origin: "none",
  Skull: "spooky", // detuned, wobbling, a little haunted
  Radioactive: "glitch", // bit-crushed
  "1:1": "none", // the ten 1:1s use their signature sound instead
};

export const FLAVOUR_SETTINGS = {
  spooky: { detuneSpreadCents: 35, vibratoHz: 5, vibratoDepth: 0.25 },
  glitch: { bits: 5 },
} as const;

// ---------------------------------------------------------------------------
// 3. Tier -> volume, Spotlight weight, second layer
// ---------------------------------------------------------------------------

export type Tier = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
// octave: the same part doubled an octave up. harmony: a second voice two scale
// steps above. signature: both. Drums get an extra percussion layer instead.
export type Layer = "none" | "octave" | "harmony" | "signature";

export const TIER_SETTINGS: Record<Tier, { volumeDb: number; spotlightWeight: number; layer: Layer }> = {
  Common: { volumeDb: -12, spotlightWeight: 1, layer: "none" },
  Uncommon: { volumeDb: -10, spotlightWeight: 2, layer: "none" },
  Rare: { volumeDb: -8, spotlightWeight: 4, layer: "octave" },
  Epic: { volumeDb: -7, spotlightWeight: 8, layer: "harmony" },
  Legendary: { volumeDb: -6, spotlightWeight: 16, layer: "signature" },
};

// Per-role trim so a full band stays balanced.
export const ROLE_TRIM_DB: Record<Role, number> = { drums: -2, bass: 0, chords: -5, melody: -3 };

// ---------------------------------------------------------------------------
// 4. Eyes -> pitch range
// ---------------------------------------------------------------------------

export type Range = "low" | "mid" | "high";

export const EYES_RANGE: [Range, string[]][] = [
  ["high", ["laser", "visor", "vr", "viper", "heart", "happy", "up", "xd", "anime"]],
  ["low", ["dead", "tired", "cry", "crying", "tear", "teary", "closed", "flat", "angry", "thug", "mog", "worried"]],
];
export const EYES_RANGE_FALLBACK: Range = "mid"; // Round, Normal, Side Eye, Smirk, Frog, Clown, glasses...

// Octave of scale degree 0 for each role and range.
export const ROLE_OCTAVE: Record<Exclude<Role, "drums">, Record<Range, number>> = {
  bass: { low: 1, mid: 2, high: 3 },
  chords: { low: 3, mid: 4, high: 5 },
  melody: { low: 4, mid: 5, high: 6 },
};
// Drums: range tunes the kit.
export const DRUM_TUNING: Record<Range, { kick: string; tom: string; hatHz: number }> = {
  low: { kick: "A0", tom: "D2", hatHz: 180 },
  mid: { kick: "C1", tom: "G2", hatHz: 250 },
  high: { kick: "E1", tom: "C3", hatHz: 340 },
};

// ---------------------------------------------------------------------------
// 5. Mouth -> note shape
// ---------------------------------------------------------------------------

export type Shape = "short" | "medium" | "long";

export const MOUTH_SHAPE: [Shape, string[]][] = [
  ["short", ["bite", "grit", "coin", "tooth", "flat"]],
  ["long", ["drool", "drooling", "puke", "bubblegum", "sad", "wo", "worried"]],
];
export const MOUTH_SHAPE_FALLBACK: Shape = "medium"; // Smile, normal smile, Clown Mouth, and no Mouth at all

export const SHAPE_ENVELOPE: Record<Shape, { attack: number; decay: number; sustain: number; release: number; duration: string; drumDecayScale: number }> = {
  short: { attack: 0.003, decay: 0.12, sustain: 0, release: 0.08, duration: "16n", drumDecayScale: 0.6 },
  medium: { attack: 0.01, decay: 0.25, sustain: 0.35, release: 0.35, duration: "8n", drumDecayScale: 1 },
  long: { attack: 0.06, decay: 0.5, sustain: 0.6, release: 1.2, duration: "4n", drumDecayScale: 1.6 },
};

// ---------------------------------------------------------------------------
// 6. Body -> tone colour family
// ---------------------------------------------------------------------------

export type Family = "meme" | "costume" | "outlaw" | "mystic" | "regal" | "street" | "bare";

export const BODY_FAMILY: [Family, string[]][] = [
  ["meme", ["six", "milf", "virgin", "bbc", "boner", "zero", "cwo", "143", "glitch", "electro", "mon", "sci"]],
  ["costume", ["duck", "shark", "banana", "dragon", "toad", "astro", "squid", "mummy", "guko", "gojo"]],
  ["outlaw", ["inmate", "prisoner", "stripe", "homeless", "chug", "holed", "army"]],
  ["mystic", ["wizard", "jesus", "chinese", "yukata"]],
  ["regal", ["tuxedo", "robe", "vest", "armor", "gangster", "mafia", "ceo", "kings", "suit"]],
  ["street", ["hoodie", "trackset", "tee", "shirt", "jersey", "tank", "sleeveless", "jacket", "farmer", "hawaiian", "polo", "fire"]],
];
// No Body (207 Chogs, incl. "Naked") -> "bare", the role's plain default sound.
// A Body that matches no keyword above also falls back to "street".
export const BODY_FAMILY_UNMATCHED: Family = "street";

type Osc = "sine" | "triangle" | "square" | "sawtooth" | "fmsine" | "fmsquare" | "amtriangle" | "pulse";

export const FAMILY_TONE: Record<Family, { label: string; oscillator: Osc; drumNoise: "white" | "pink" | "brown"; drumKit: string }> = {
  regal: { label: "brassy saw", oscillator: "sawtooth", drumNoise: "pink", drumKit: "big room kit" },
  street: { label: "square synth", oscillator: "square", drumNoise: "white", drumKit: "808 kit" },
  costume: { label: "bouncy FM", oscillator: "fmsine", drumNoise: "white", drumKit: "toy kit" },
  mystic: { label: "soft AM glass", oscillator: "amtriangle", drumNoise: "pink", drumKit: "hand drums" },
  outlaw: { label: "gritty pulse", oscillator: "pulse", drumNoise: "brown", drumKit: "junkyard kit" },
  meme: { label: "buzzy FM", oscillator: "fmsquare", drumNoise: "white", drumKit: "glitch kit" },
  bare: { label: "plain", oscillator: "triangle", drumNoise: "white", drumKit: "classic kit" },
};
// "bare" per role, so a Chog with no Body still sounds like its role.
export const ROLE_BARE_OSC: Record<Exclude<Role, "drums">, Osc> = { bass: "sine", chords: "triangle", melody: "triangle" };

// ---------------------------------------------------------------------------
// 7. Head -> filter brightness   (Skin now picks the role, so Head does this)
// ---------------------------------------------------------------------------

export type Brightness = "dark" | "warm" | "bright" | "sparkling";

export const HEAD_BRIGHTNESS: [Brightness, string[]][] = [
  ["sparkling", ["crown", "diamond", "holy", "wreath", "thorn", "laser", "3rd", "silver", "gold"]],
  ["warm", ["bucket", "beanie", "headband", "hair", "wig", "nose", "durag", "plumber", "neet", "bandana", "wrap", "taped"]],
  ["bright", ["cap", "mcga", "mega"]],
  ["dark", ["hat", "helmet", "horn", "robber", "shroom", "devil", "demon", "void"]],
];
export const HEAD_BRIGHTNESS_FALLBACK: Brightness = "warm"; // no Head, or no keyword match

export const BRIGHTNESS_CUTOFF_HZ: Record<Brightness, number> = { dark: 900, warm: 1800, bright: 3500, sparkling: 7500 };

// ---------------------------------------------------------------------------
// 8. Aura -> effect
// ---------------------------------------------------------------------------

export type Effect = "dry" | "distortion" | "echo" | "chorus" | "shimmer" | "phaser";

export const AURA_EFFECT: [Effect, string[]][] = [
  ["dry", ["clean"]],
  ["shimmer", ["royal", "white", "yellow"]],
  ["distortion", ["burning", "fiery", "fire", "electric"]],
  ["echo", ["aqua", "cool", "wind", "blue"]],
  ["chorus", ["purple", "violet", "light", "rose", "pink"]],
  ["phaser", ["smoke", "mint", "green"]],
];
export const AURA_EFFECT_FALLBACK: Effect = "dry"; // no Aura (about half of all Chogs)

// ---------------------------------------------------------------------------
// 9. Background -> reverb room
// ---------------------------------------------------------------------------

export type Room = "small" | "medium" | "large" | "hall";

export const BACKGROUND_ROOM: [Room, string[]][] = [
  ["hall", ["gold", "royal", "supreme", "noble", "blood", "red sky", "deep purple", "radioactive"]],
  ["large", ["deep", "sky", "mon", "aqua blue", "magenta"]],
  ["medium", ["purple", "lavender", "light", "aqua", "mint"]],
  ["small", ["lemon", "yellow", "sunlight", "pink", "peach", "coral", "rosie", "rosy", "rose", "green", "lime", "fresh", "orange", "bright"]],
];
export const BACKGROUND_ROOM_FALLBACK: Room = "medium";

export const ROOM_SETTINGS: Record<Room, { decay: number; wet: number }> = {
  small: { decay: 0.8, wet: 0.15 },
  medium: { decay: 1.8, wet: 0.22 },
  large: { decay: 3.5, wet: 0.3 },
  hall: { decay: 6, wet: 0.38 },
};

// ---------------------------------------------------------------------------
// 10. Side -> pan
// ---------------------------------------------------------------------------

export const SIDE_PAN: Record<string, number> = { Left: -0.4, Right: 0.4 };
export const SIDE_PAN_FALLBACK = 0;

// ---------------------------------------------------------------------------
// 11. Accessory -> sparkle layer
// ---------------------------------------------------------------------------

export type Sparkle = "none" | "bell" | "chime" | "glass";

export const ACCESSORY_SPARKLE: [Sparkle, string[]][] = [
  ["bell", ["coin", "heart", "sb"]],
  ["chime", ["green", "red", "candle"]],
  ["glass", ["fwog", "pepe", "cigar", "knife"]],
];
export const ACCESSORY_SPARKLE_UNMATCHED: Sparkle = "bell"; // any accessory gets some sparkle
export const SPARKLE_SETTINGS: Record<Exclude<Sparkle, "none">, { harmonicity: number; modulationIndex: number; semitonesUp: number; volumeDb: number }> = {
  bell: { harmonicity: 3.01, modulationIndex: 12, semitonesUp: 24, volumeDb: -20 },
  chime: { harmonicity: 5.07, modulationIndex: 8, semitonesUp: 31, volumeDb: -22 },
  glass: { harmonicity: 1.5, modulationIndex: 4, semitonesUp: 24, volumeDb: -21 },
};

// ---------------------------------------------------------------------------
// 12. Legendary 1:1 signatures (these Chogs only have Base "1:1" and Tier)
// ---------------------------------------------------------------------------

export type Signature = {
  title: string;
  role: Role;
  range: Range;
  shape: Shape;
  family: Family;
  brightness: Brightness;
  effect: Effect;
  room: Room;
  pan: number;
  flavour: Flavour;
  sparkle: Sparkle;
};

export const LEGENDARY_SIGNATURES: Record<number, Signature> = {
  561: { title: "Blaze", role: "melody", range: "high", shape: "medium", family: "regal", brightness: "sparkling", effect: "distortion", room: "large", pan: -0.2, flavour: "none", sparkle: "none" },
  900: { title: "Burning Skully", role: "bass", range: "low", shape: "medium", family: "outlaw", brightness: "warm", effect: "distortion", room: "medium", pan: 0, flavour: "spooky", sparkle: "none" },
  942: { title: "Chog Scream", role: "melody", range: "high", shape: "long", family: "meme", brightness: "bright", effect: "echo", room: "hall", pan: 0.3, flavour: "none", sparkle: "none" },
  1002: { title: "Chogbomination", role: "drums", range: "low", shape: "medium", family: "meme", brightness: "dark", effect: "distortion", room: "medium", pan: 0, flavour: "glitch", sparkle: "none" },
  1481: { title: "Frogger", role: "bass", range: "mid", shape: "short", family: "costume", brightness: "bright", effect: "phaser", room: "small", pan: 0.15, flavour: "none", sparkle: "glass" },
  1514: { title: "Grim", role: "chords", range: "low", shape: "long", family: "outlaw", brightness: "dark", effect: "chorus", room: "hall", pan: -0.3, flavour: "spooky", sparkle: "none" },
  1667: { title: "Halo", role: "chords", range: "high", shape: "long", family: "mystic", brightness: "sparkling", effect: "shimmer", room: "hall", pan: 0.3, flavour: "none", sparkle: "chime" },
  1798: { title: "Krown", role: "melody", range: "mid", shape: "medium", family: "regal", brightness: "bright", effect: "shimmer", room: "large", pan: 0, flavour: "none", sparkle: "bell" },
  1881: { title: "Midas", role: "chords", range: "mid", shape: "medium", family: "costume", brightness: "sparkling", effect: "chorus", room: "large", pan: -0.15, flavour: "none", sparkle: "bell" },
  1884: { title: "Redd", role: "drums", range: "high", shape: "short", family: "street", brightness: "bright", effect: "distortion", room: "small", pan: 0.2, flavour: "none", sparkle: "none" },
};

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export type Traits = Record<string, string>;

export type ChogSound = {
  tokenId: number;
  role: Role;
  range: Range;
  shape: Shape;
  family: Family;
  oscillator: Osc;
  brightness: Brightness;
  cutoffHz: number;
  effect: Effect;
  room: Room;
  pan: number;
  flavour: Flavour;
  sparkle: Sparkle;
  tier: Tier;
  volumeDb: number;
  spotlightWeight: number;
  layer: Layer;
  signature: string | null;
  description: string;
};

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9:]+/).filter(Boolean);
}

/** True if the value's words contain the keyword's words in a row, each starting with the keyword word. */
export function matchesKeyword(value: string, keyword: string): boolean {
  const v = words(value);
  const k = words(keyword);
  for (let i = 0; i + k.length <= v.length; i++) {
    if (k.every((kw, j) => v[i + j].startsWith(kw))) return true;
  }
  return false;
}

export function pickGroup<G>(value: string | undefined, table: [G, string[]][], fallback: G): G {
  if (!value) return fallback;
  for (const [group, keywords] of table) {
    if (keywords.some((k) => matchesKeyword(value, k))) return group;
  }
  return fallback;
}

function toTier(value: string | undefined): Tier {
  return value && value in TIER_SETTINGS ? (value as Tier) : "Common";
}

function oscillatorFor(role: Role, family: Family): Osc {
  if (family === "bare" && role !== "drums") return ROLE_BARE_OSC[role];
  return FAMILY_TONE[family].oscillator;
}

export function chogSound(tokenId: number, traits: Traits): ChogSound {
  const tier = toTier(traits.Tier);
  const tierSettings = TIER_SETTINGS[tier];
  const signature = LEGENDARY_SIGNATURES[tokenId] ?? null;

  const role = signature?.role ?? SKIN_ROLE[traits.Skin] ?? SKIN_ROLE_FALLBACK;
  const range = signature?.range ?? pickGroup(traits.Eyes, EYES_RANGE, EYES_RANGE_FALLBACK);
  const shape = signature?.shape ?? pickGroup(traits.Mouth, MOUTH_SHAPE, MOUTH_SHAPE_FALLBACK);
  const family = signature?.family ?? (traits.Body ? pickGroup(traits.Body, BODY_FAMILY, BODY_FAMILY_UNMATCHED) : "bare");
  const brightness = signature?.brightness ?? pickGroup(traits.Head, HEAD_BRIGHTNESS, HEAD_BRIGHTNESS_FALLBACK);
  const effect = signature?.effect ?? pickGroup(traits.Aura, AURA_EFFECT, AURA_EFFECT_FALLBACK);
  const room = signature?.room ?? pickGroup(traits.Background, BACKGROUND_ROOM, BACKGROUND_ROOM_FALLBACK);
  const pan = signature?.pan ?? SIDE_PAN[traits.Side] ?? SIDE_PAN_FALLBACK;
  const flavour = signature?.flavour ?? BASE_FLAVOUR[traits.Base] ?? "none";
  const sparkle = signature?.sparkle ?? (traits.Accessory ? pickGroup(traits.Accessory, ACCESSORY_SPARKLE, ACCESSORY_SPARKLE_UNMATCHED) : "none");

  const sound: Omit<ChogSound, "description"> = {
    tokenId,
    role,
    range,
    shape,
    family,
    oscillator: oscillatorFor(role, family),
    brightness,
    cutoffHz: BRIGHTNESS_CUTOFF_HZ[brightness],
    effect,
    room,
    pan,
    flavour,
    sparkle,
    tier,
    volumeDb: tierSettings.volumeDb + ROLE_TRIM_DB[role],
    spotlightWeight: tierSettings.spotlightWeight,
    layer: signature ? "signature" : tierSettings.layer,
    signature: signature?.title ?? null,
  };
  return { ...sound, description: describe(sound) };
}

const LAYER_LABEL: Record<Layer, string | null> = {
  none: null,
  octave: "+ octave layer",
  harmony: "+ harmony layer",
  signature: "+ octave and harmony layers",
};

function describe(s: Omit<ChogSound, "description">): string {
  const tone = s.role === "drums" ? FAMILY_TONE[s.family].drumKit : s.family === "bare" ? `plain ${s.oscillator}` : FAMILY_TONE[s.family].label;
  const parts = [
    s.signature ? `Signature "${s.signature}"` : null,
    `${s.range} ${s.role}`,
    tone,
    `${s.shape} notes`,
    `${s.brightness} filter`,
    s.effect === "dry" ? "dry" : s.effect,
    `${s.room} room`,
    s.pan < 0 ? "panned left" : s.pan > 0 ? "panned right" : "centre",
    s.flavour !== "none" ? s.flavour : null,
    s.sparkle !== "none" ? `${s.sparkle} sparkle` : null,
    LAYER_LABEL[s.layer],
  ];
  return parts.filter(Boolean).join(" · ");
}

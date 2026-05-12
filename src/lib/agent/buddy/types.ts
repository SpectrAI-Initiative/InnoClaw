/**
 * Buddy companion type definitions and constants.
 * Ported from cc-mini's buddy/types.py
 */

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

export const RARITY_STARS: Record<Rarity, string> = {
  common: "\u2605",
  uncommon: "\u2605\u2605",
  rare: "\u2605\u2605\u2605",
  epic: "\u2605\u2605\u2605\u2605",
  legendary: "\u2605\u2605\u2605\u2605\u2605",
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: "#8b949e",
  uncommon: "#3fb950",
  rare: "#58a6ff",
  epic: "#bc8cff",
  legendary: "#d2a8ff",
};

export const RARITY_FLOOR: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
};

export const SPECIES = [
  "duck", "goose", "blob", "cat", "dragon", "octopus", "owl", "penguin",
  "turtle", "snail", "ghost", "axolotl", "capybara", "cactus", "robot",
  "rabbit", "mushroom", "chonk",
] as const;
export type Species = (typeof SPECIES)[number];

export const SPECIES_EMOJI: Record<string, string> = {
  duck: "\ud83e\udd86",
  goose: "\ud83e\udeb7",
  blob: "\ud83e\udea0",
  cat: "\ud83d\udc31",
  dragon: "\ud83d\udc09",
  octopus: "\ud83d\udc19",
  owl: "\ud83e\udd89",
  penguin: "\ud83d\udc27",
  turtle: "\ud83d\udc22",
  snail: "\ud83d\udc0c",
  ghost: "\ud83d\udc7b",
  axolotl: "\ud83e\udd8e",
  capybara: "\ud83e\uddab",
  cactus: "\ud83c\udf35",
  robot: "\ud83e\udd16",
  rabbit: "\ud83d\udc30",
  mushroom: "\ud83c\udf44",
  chonk: "\ud83d\udc3b",
};

export const EYES = ["\u00b7", "\u2726", "\u00d7", "\u25c9", "@", "\u00b0"] as const;
export const HATS = ["none", "crown", "tophat", "propeller", "halo", "wizard", "beanie", "tinyduck"] as const;
export const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"] as const;
export type StatName = (typeof STAT_NAMES)[number];

export interface CompanionBones {
  rarity: Rarity;
  species: string;
  eye: string;
  hat: string;
  shiny: boolean;
  stats: Record<StatName, number>;
}

export interface CompanionSoul {
  name: string;
  personality: string;
}

export interface Companion extends CompanionBones, CompanionSoul {
  hatchedAt: number;
  muted: boolean;
}

export interface StoredCompanion {
  name: string;
  personality: string;
  hatchedAt: number;
  seed: string;
  muted: boolean;
}

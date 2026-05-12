/**
 * Deterministic companion generation from user ID.
 * Ported from cc-mini's buddy/companion.ts
 *
 * Same userId always produces the same CompanionBones.
 */

import {
  SPECIES,
  EYES,
  HATS,
  RARITIES,
  RARITY_WEIGHTS,
  RARITY_FLOOR,
  STAT_NAMES,
  type CompanionBones,
  type Rarity,
  type StatName,
} from "./types";

const MASK = 0xFFFFFFFF;

// Mulberry32 — seeded PRNG, same algorithm as cc-mini
function mulberry32(seed: number): () => number {
  let a = seed & MASK;
  return () => {
    a = (a | 0) & MASK;
    a = (a + 0x6D2B79F5) & MASK;
    let t = ((a ^ (a >>> 15)) * (1 | a)) & MASK;
    t = (t + (((t ^ (t >>> 7)) * (61 | t)) & MASK)) & MASK;
    return ((t ^ (t >>> 14)) & MASK) / 4294967296;
  };
}

// FNV-1a hash
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) & MASK;
  }
  return h & MASK;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const rarity of RARITIES) {
    r -= RARITY_WEIGHTS[rarity];
    if (r < 0) return rarity;
  }
  return "common";
}

function rollStats(rng: () => number, rarity: Rarity): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);

  const stats = {} as Record<StatName, number>;
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[name] = floor + Math.floor(rng() * 40);
    }
  }
  return stats;
}

const SALT = "friend-2026-401";

export interface Roll {
  bones: CompanionBones;
  inspirationSeed: number;
}

function rollFrom(rng: () => number): Roll {
  const rarity = rollRarity(rng);
  const bones: CompanionBones = {
    rarity,
    species: pick(rng, SPECIES),
    eye: pick(rng, EYES),
    hat: rarity === "common" ? "none" : pick(rng, HATS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity),
  };
  return { bones, inspirationSeed: Math.floor(rng() * 1e9) };
}

export function roll(userId: string): Roll {
  const key = userId + SALT;
  return rollFrom(mulberry32(hashString(key)));
}

export function rollWithSeed(seed: string): Roll {
  return rollFrom(mulberry32(hashString(seed)));
}

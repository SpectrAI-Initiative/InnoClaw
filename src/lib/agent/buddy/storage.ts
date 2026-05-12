/**
 * Client-side localStorage persistence for buddy companion data.
 */

import type { StoredCompanion, Companion } from "./types";
import { rollWithSeed } from "./companion";

const STORAGE_KEY = "buddy-companion";

export function loadStoredCompanion(): StoredCompanion | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredCompanion;
  } catch {
    return null;
  }
}

export function saveStoredCompanion(stored: StoredCompanion): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

export function deleteStoredCompanion(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

export function getCompanion(): Companion | null {
  const stored = loadStoredCompanion();
  if (!stored) return null;

  const { bones } = rollWithSeed(stored.seed);
  return {
    ...bones,
    name: stored.name,
    personality: stored.personality,
    hatchedAt: stored.hatchedAt,
    muted: stored.muted ?? false,
  };
}

export function setMuted(muted: boolean): void {
  const stored = loadStoredCompanion();
  if (!stored) return;
  stored.muted = muted;
  saveStoredCompanion(stored);
}

/**
 * Per-browser cache of AI-translated skill descriptions.
 *
 * Persisted key (shared contract): `innoclaw.skillDescriptionTranslations.v1.<locale>`
 * → JSON object mapping `<skillId>:<hash of the original description>` to the
 * translated text. Including the description hash means an edited description
 * is translated again instead of showing a stale translation.
 */

const STORAGE_PREFIX = "innoclaw.skillDescriptionTranslations.v1.";
/** Keep the cache bounded even if skills churn. */
const MAX_ENTRIES = 2000;

/** Small, stable string hash (djb2) — enough to detect edited descriptions. */
export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function skillTranslationKey(skillId: string, description: string): string {
  return `${skillId}:${hashText(description)}`;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSkillTranslationCache(locale: string): Record<string, string> {
  try {
    const raw = storage()?.getItem(STORAGE_PREFIX + locale);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

export function writeSkillTranslationCache(locale: string, entries: Record<string, string>): void {
  if (Object.keys(entries).length === 0) return;
  try {
    const merged = { ...readSkillTranslationCache(locale), ...entries };
    const keys = Object.keys(merged);
    const trimmed = keys.length > MAX_ENTRIES
      ? Object.fromEntries(keys.slice(keys.length - MAX_ENTRIES).map((k) => [k, merged[k]]))
      : merged;
    storage()?.setItem(STORAGE_PREFIX + locale, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded or storage disabled: translations still work for this visit.
  }
}

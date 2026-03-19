import { useCallback, useRef } from "react";
import type { Article, ArticleSource } from "@/lib/article-search/types";

const STORAGE_KEY = "paperStudy.cache";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/** Serialisable snapshot of the paper-study panel state. */
export interface PaperStudyCacheData {
  keywords: string[];
  dateFrom: string;
  dateTo: string;
  sources: ArticleSource[];
  articles: Article[];
  selectedArticle: Article | null;
  checkedIds: string[]; // serialised from Set<string>
  summary: string;
  roast: string;
  hasSearched: boolean;
}

interface CacheEnvelope {
  data: PaperStudyCacheData;
  savedAt: number;
}

function isValidCacheEnvelope(value: unknown): value is CacheEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }
  const envelope = value as { data?: unknown; savedAt?: unknown };
  if (typeof envelope.savedAt !== "number" || !Number.isFinite(envelope.savedAt)) {
    return false;
  }
  if (typeof envelope.data !== "object" || envelope.data === null) {
    return false;
  }
  return true;
}

function readCache(): PaperStudyCacheData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidCacheEnvelope(parsed)) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be blocked */ }
      return null;
    }
    const envelope = parsed;
    if (Date.now() - envelope.savedAt > TTL_MS) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage may be blocked */ }
      return null;
    }
    return envelope.data;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }
    return null;
  }
}

/**
 * Hook that provides read/write access to a 6-hour localStorage cache
 * for paper-study panel state.
 *
 * `cachedState` is evaluated once on first render (lazy initial value).
 * `saveCache` writes the current state snapshot to localStorage.
 */
export function usePaperStudyCache() {
  // Read cache only once, on mount
  const cachedState = useRef<PaperStudyCacheData | null | undefined>(undefined);
  if (cachedState.current === undefined) {
    cachedState.current = readCache();
  }

  const saveCache = useCallback((state: PaperStudyCacheData) => {
    try {
      const envelope: CacheEnvelope = { data: state, savedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      // Ignore quota errors
    }
  }, []);

  return { cachedState: cachedState.current, saveCache } as const;
}

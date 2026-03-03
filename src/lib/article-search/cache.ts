/**
 * Simple in-memory cache with TTL to avoid repeated API requests.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class SearchCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  /**
   * @param ttlMinutes Cache TTL in minutes (default: 15).
   */
  constructor(ttlMinutes = 15) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /** Generate a cache key from search parameters. */
  static buildKey(params: Record<string, unknown>): string {
    return JSON.stringify(params, Object.keys(params).sort());
  }

  /** Get a cached value, or undefined if missing / expired. */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /** Store a value in the cache. */
  set(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.ttlMs });
  }

  /** Remove expired entries. */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }

  /** Clear the entire cache. */
  clear(): void {
    this.cache.clear();
  }
}

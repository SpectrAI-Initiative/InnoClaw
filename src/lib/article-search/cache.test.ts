import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SearchCache } from "./cache";

describe("SearchCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a value", () => {
    const cache = new SearchCache<string>(15);
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns undefined for missing keys", () => {
    const cache = new SearchCache<string>(15);
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("expires entries after TTL", () => {
    const cache = new SearchCache<string>(1); // 1 minute TTL
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");

    // Advance time beyond TTL
    vi.advanceTimersByTime(61 * 1000);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("keeps entries within TTL", () => {
    const cache = new SearchCache<string>(5); // 5 minute TTL
    cache.set("key1", "value1");

    // Advance time but stay within TTL
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(cache.get("key1")).toBe("value1");
  });

  it("buildKey produces deterministic keys regardless of property order", () => {
    const key1 = SearchCache.buildKey({ a: 1, b: 2 });
    const key2 = SearchCache.buildKey({ b: 2, a: 1 });
    expect(key1).toBe(key2);
  });

  it("prune removes expired entries", () => {
    const cache = new SearchCache<string>(1);
    cache.set("key1", "value1");
    cache.set("key2", "value2");

    vi.advanceTimersByTime(61 * 1000);
    cache.prune();

    expect(cache.get("key1")).toBeUndefined();
    expect(cache.get("key2")).toBeUndefined();
  });

  it("clear removes all entries", () => {
    const cache = new SearchCache<string>(15);
    cache.set("key1", "value1");
    cache.set("key2", "value2");
    cache.clear();

    expect(cache.get("key1")).toBeUndefined();
    expect(cache.get("key2")).toBeUndefined();
  });
});

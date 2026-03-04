/**
 * Article search module — orchestrates search across multiple sources.
 *
 * This module is the main entry point for article search. It delegates to
 * source-specific clients (arXiv, Hugging Face) and applies caching.
 */

import type { Article, SearchParams, SearchResult } from "./types";
import { searchArxiv } from "./arxiv";
import { searchHuggingFace } from "./huggingface";
import { SearchCache } from "./cache";

export type { Article, SearchParams, SearchResult, ArticleSource } from "./types";

/** Shared cache instance (15-minute TTL). */
const cache = new SearchCache<Article[]>(15);

/**
 * Search for articles across configured sources.
 *
 * Results are cached to avoid repeated API requests for the same query.
 */
export async function searchArticles(
  params: SearchParams
): Promise<SearchResult> {
  const sources = params.sources ?? ["arxiv", "huggingface"];
  const allArticles: Article[] = [];
  const errors: Record<string, string> = {};

  // Run searches concurrently across requested sources
  const tasks = sources.map(async (source) => {
    // Build cache key per-source; exclude the original `sources` array to
    // avoid redundant entries when sources are specified in different orders.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sources: _ignored, ...restParams } = params;
    const cacheKey = SearchCache.buildKey({ source, ...restParams });
    const cached = cache.get(cacheKey);
    if (cached) {
      return { source, articles: cached };
    }

    try {
      let articles: Article[];
      if (source === "arxiv") {
        articles = await searchArxiv(params);
      } else {
        articles = await searchHuggingFace(params);
      }
      cache.set(cacheKey, articles);
      return { source, articles };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { source, articles: [], error: msg };
    }
  });

  const results = await Promise.all(tasks);

  for (const r of results) {
    allArticles.push(...r.articles);
    if ("error" in r && r.error) {
      errors[r.source] = r.error;
    }
  }

  return {
    articles: allArticles,
    totalCount: allArticles.length,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Find articles related to a given article by keyword overlap.
 *
 * This is a lightweight content-similarity approach: it extracts significant
 * words from the title and searches for them across the configured sources.
 */
export async function findRelatedArticles(
  article: Article,
  maxResults = 3
): Promise<Article[]> {
  // Extract significant words from the title (skip very short words)
  const stopWords = new Set([
    "a", "an", "the", "and", "or", "for", "of", "in", "on", "to", "with",
    "is", "are", "was", "were", "by", "from", "at", "as", "its", "this",
    "that", "it", "be", "has", "have", "had", "not", "but", "can", "will",
  ]);
  const words = article.title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  // Use up to 3 most significant words as keywords
  const keywords = words.slice(0, 3);
  if (keywords.length === 0) return [];

  const result = await searchArticles({
    keywords,
    maxResults: maxResults + 5, // fetch extra to filter out the source article
  });

  return result.articles
    .filter((a) => a.id !== article.id)
    .slice(0, maxResults);
}

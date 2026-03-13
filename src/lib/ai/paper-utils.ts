import { PAPER } from "@/lib/constants";

export interface TrimmedArticle {
  title: string;
  authors: string[];
  publishedDate: string;
  source: string;
  abstract: string;
}

/** Trim and sanitize article data for LLM consumption. */
export function trimArticlesForLLM(
  articles: Record<string, unknown>[]
): TrimmedArticle[] {
  return articles.slice(0, PAPER.MAX_BATCH_SIZE).map((a) => ({
    title: String(a.title || ""),
    authors: Array.isArray(a.authors) ? a.authors.map(String) : [],
    publishedDate: String(a.publishedDate || ""),
    source: String(a.source || ""),
    abstract: String(a.abstract || "").slice(0, PAPER.MAX_ABSTRACT_CHARS),
  }));
}

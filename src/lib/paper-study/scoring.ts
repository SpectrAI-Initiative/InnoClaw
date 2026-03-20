/**
 * Paper scoring and filtering system.
 *
 * Ported from dailypaper-skills `fetch_and_score.py`.
 * Scores papers based on keyword relevance, domain boost, and trending metrics.
 */

import type { Article } from "@/lib/article-search/types";
import type { DailyPapersConfig } from "./config";

export interface ScoredArticle extends Article {
  /** Relevance score computed by the scoring algorithm. */
  score: number;
  /** Upvote count (from HuggingFace). */
  upvotes?: number;
}

/**
 * Score a single paper against the configuration keywords.
 *
 * Scoring rules (from dailypaper-skills):
 * - Negative keyword match → -999 (instant reject)
 * - Positive keyword in title → +3
 * - Positive keyword in abstract → +1
 * - Domain boost: 2+ keyword matches → +2, 1 match → +1
 * - Trending boost (HF papers with upvotes):
 *   - Relevant paper (keyword/domain hit): ≥10 upvotes +3, ≥5 +2, ≥2 +1
 *   - Irrelevant paper: ≥20 upvotes +1
 */
export function scorePaper(
  article: Article & { upvotes?: number },
  config: DailyPapersConfig
): number {
  const titleLower = (article.title || "").toLowerCase();
  const abstractLower = (article.abstract || "").toLowerCase();
  const text = `${titleLower} ${abstractLower}`;

  // Negative keywords → instant reject
  for (const neg of config.negative_keywords) {
    if (text.includes(neg.toLowerCase())) {
      return -999;
    }
  }

  let score = 0;
  let keywordHits = 0;

  // Positive keywords
  for (const kw of config.keywords) {
    const kwLower = kw.toLowerCase();
    if (titleLower.includes(kwLower)) {
      score += 3;
      keywordHits++;
    } else if (abstractLower.includes(kwLower)) {
      score += 1;
      keywordHits++;
    }
  }

  // Domain boost keywords
  let domainHits = 0;
  for (const kw of config.domain_boost_keywords) {
    if (text.includes(kw.toLowerCase())) {
      domainHits++;
    }
  }
  if (domainHits >= 2) {
    score += 2;
  } else if (domainHits === 1) {
    score += 1;
  }

  // Trending boost (HuggingFace upvotes)
  const upvotes = article.upvotes ?? 0;
  if (upvotes > 0) {
    const isRelevant = keywordHits > 0 || domainHits > 0;
    if (isRelevant) {
      if (upvotes >= 10) score += 3;
      else if (upvotes >= 5) score += 2;
      else if (upvotes >= 2) score += 1;
    } else {
      // Popular but not keyword-relevant
      if (upvotes >= 20) score += 1;
    }
  }

  return score;
}

/**
 * Score, filter, and rank a list of papers.
 *
 * @returns Papers with score ≥ min_score, sorted by score descending, limited to top_n.
 */
export function filterAndRankPapers(
  articles: (Article & { upvotes?: number })[],
  config: DailyPapersConfig
): ScoredArticle[] {
  const scored: ScoredArticle[] = articles.map((a) => ({
    ...a,
    score: scorePaper(a, config),
  }));

  return scored
    .filter((a) => a.score >= config.min_score)
    .sort((a, b) => b.score - a.score)
    .slice(0, config.top_n);
}

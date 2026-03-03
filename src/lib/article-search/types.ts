/**
 * Types for the article search and summary module.
 */

/** Supported data sources for article search. */
export type ArticleSource = "arxiv" | "huggingface";

/** A single article returned from search. */
export interface Article {
  /** Unique identifier (e.g. arXiv ID or HF paper ID). */
  id: string;
  /** Article title. */
  title: string;
  /** List of author names. */
  authors: string[];
  /** Abstract / summary text. */
  abstract: string;
  /** URL to the article page. */
  url: string;
  /** PDF link if available. */
  pdfUrl?: string;
  /** Publication or submission date (ISO 8601). */
  publishedDate: string;
  /** Data source. */
  source: ArticleSource;
}

/** Parameters for searching articles. */
export interface SearchParams {
  /** Keywords to search for. */
  keywords: string[];
  /** Maximum number of results to return per source. */
  maxResults?: number;
  /** Only return articles published after this date (ISO 8601). */
  dateFrom?: string;
  /** Only return articles published before this date (ISO 8601). */
  dateTo?: string;
  /** Which sources to search. Defaults to all. */
  sources?: ArticleSource[];
}

/** Result of a search operation. */
export interface SearchResult {
  /** The articles found. */
  articles: Article[];
  /** Total count across all sources. */
  totalCount: number;
  /** Any errors encountered per source. */
  errors?: Partial<Record<ArticleSource, string>>;
}

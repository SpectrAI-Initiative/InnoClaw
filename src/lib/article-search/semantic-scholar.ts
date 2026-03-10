/**
 * Semantic Scholar API client.
 *
 * Uses the Semantic Scholar Academic Graph API for semantic/relevance-based
 * paper search. Unlike keyword-based sources, this accepts natural language
 * queries and returns results ranked by semantic relevance.
 *
 * Rate limit: 100 requests per 5 minutes (unauthenticated).
 * @see https://api.semanticscholar.org/
 */

import type { Article, SearchParams } from "./types";

const S2_API_URL = "https://api.semanticscholar.org/graph/v1/paper/search";

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

/** Max retries on transient errors (429, 5xx, network). */
const MAX_RETRIES = 3;

/** Base delay (ms) before retrying. Doubles on each retry. */
const RETRY_BASE_DELAY_MS = 3_000;

/** Fields to request from the API. */
const FIELDS = "paperId,title,abstract,authors,year,externalIds,url,openAccessPdf";

/**
 * Search Semantic Scholar for papers matching the given parameters.
 *
 * Keywords are joined into a single natural-language query string,
 * which Semantic Scholar uses for semantic relevance ranking.
 */
export async function searchSemanticScholar(
  params: SearchParams
): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  if (!keywords.length) return [];

  // Join keywords into a natural-language query
  const query = keywords.join(" ");

  // Build URL with query parameters
  const url = new URL(S2_API_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(Math.min(maxResults, 100)));
  url.searchParams.set("fields", FIELDS);

  // Semantic Scholar supports year filter (single year or range "2020-2024")
  if (dateFrom || dateTo) {
    const fromYear = dateFrom ? new Date(dateFrom).getFullYear() : undefined;
    const toYear = dateTo ? new Date(dateTo).getFullYear() : undefined;
    if (fromYear && toYear) {
      url.searchParams.set("year", `${fromYear}-${toYear}`);
    } else if (fromYear) {
      url.searchParams.set("year", `${fromYear}-`);
    } else if (toYear) {
      url.searchParams.set("year", `-${toYear}`);
    }
  }

  let response: Response | undefined;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error("Semantic Scholar API request timed out");
      } else {
        lastError = new Error(
          `Semantic Scholar API network error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      // Retry on transient network errors
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * Math.pow(2, attempt)));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }

    // Retry on rate-limit (429) and server errors (5xx)
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      lastError = new Error(
        response.status === 429
          ? "Semantic Scholar API rate limited (429)"
          : `Semantic Scholar API server error (${response.status})`
      );
      response = undefined;
      continue;
    }

    break;
  }

  if (!response) {
    throw lastError || new Error("Semantic Scholar API request failed");
  }

  if (!response.ok) {
    throw new Error(
      `Semantic Scholar API error: ${response.status} ${response.statusText}`
    );
  }

  const data: S2Response = await response.json();

  return (data.data || [])
    .filter((paper) => paper.title)
    .slice(0, maxResults)
    .map(toArticle);
}

/** Shape of Semantic Scholar search response. */
interface S2Response {
  total: number;
  offset: number;
  data: S2Paper[];
}

/** Shape of a single paper from Semantic Scholar. */
interface S2Paper {
  paperId: string;
  title: string;
  abstract?: string | null;
  authors?: { name: string }[];
  year?: number | null;
  externalIds?: {
    ArXiv?: string;
    DOI?: string;
    [key: string]: string | undefined;
  };
  url?: string;
  openAccessPdf?: { url: string } | null;
}

/** Convert a Semantic Scholar paper to our Article type. */
function toArticle(paper: S2Paper): Article {
  const arxivId = paper.externalIds?.ArXiv;

  // Prefer arXiv PDF if available, otherwise use openAccessPdf
  const pdfUrl = arxivId
    ? `https://arxiv.org/pdf/${arxivId}`
    : paper.openAccessPdf?.url || undefined;

  const articleUrl =
    paper.url ||
    (arxivId
      ? `https://arxiv.org/abs/${arxivId}`
      : `https://www.semanticscholar.org/paper/${paper.paperId}`);

  return {
    id: paper.paperId,
    title: paper.title,
    authors: paper.authors?.map((a) => a.name) || [],
    abstract: paper.abstract || "",
    url: articleUrl,
    pdfUrl,
    publishedDate: paper.year ? `${paper.year}-01-01` : "",
    source: "semantic-scholar",
  };
}

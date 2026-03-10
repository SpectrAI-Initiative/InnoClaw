/**
 * arXiv API client.
 *
 * Uses the arXiv Atom API (http://export.arxiv.org/api/query) to search for
 * papers by keyword, with optional date filtering.
 *
 * Rate-limit: arXiv asks for a 3-second delay between requests.
 * @see https://info.arxiv.org/help/api/user-manual.html
 */

import type { Article, SearchParams } from "./types";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";

/** Timestamp of the last arXiv request, used for rate limiting. */
let lastRequestTime = 0;

/** Promise chain used to serialize rate-limited requests. */
let rateLimitChain: Promise<void> = Promise.resolve();

/** Minimum delay between arXiv requests in milliseconds. */
const RATE_LIMIT_MS = 3000;

/**
 * Wait if necessary to respect arXiv rate limits.
 *
 * Serializes callers via a shared promise chain so that concurrent
 * invocations still respect the global RATE_LIMIT_MS interval.
 */
async function respectRateLimit(): Promise<void> {
  rateLimitChain = rateLimitChain.then(async () => {
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, RATE_LIMIT_MS - elapsed)
      );
    }
    lastRequestTime = Date.now();
  });
  return rateLimitChain;
}

/**
 * Build the arXiv query string from keywords.
 * Combines keywords with AND for the "all" field search.
 * Multi-word keywords are wrapped in quotes for phrase matching.
 */
function buildQuery(keywords: string[]): string {
  const terms = keywords.map((kw) => {
    const trimmed = kw.trim();
    // Wrap multi-word keywords in double quotes so arXiv treats them as phrases
    const quoted = trimmed.includes(" ")
      ? `"${trimmed}"`
      : trimmed;
    return `all:${encodeURIComponent(quoted)}`;
  });
  return terms.join("+OR+");
}

/**
 * Parse arXiv Atom XML response into Article objects.
 * Uses basic string parsing to avoid heavy XML dependencies.
 */
function parseAtomResponse(xml: string): Article[] {
  const articles: Article[] = [];
  const entries = xml.split("<entry>");

  // Skip first element (it's the feed header)
  for (let i = 1; i < entries.length; i++) {
    const entry = entries[i];
    const getTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
      const match = entry.match(regex);
      return match ? match[1].trim() : "";
    };

    const id = getTag("id");
    const title = getTag("title").replace(/\s+/g, " ");
    const abstract = getTag("summary").replace(/\s+/g, " ");
    const published = getTag("published");

    // Extract authors
    const authorMatches = entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g);
    const authors = Array.from(authorMatches, (m) => m[1].trim());

    // Extract PDF link
    const pdfMatch = entry.match(
      /<link[^>]*title="pdf"[^>]*href="([^"]+)"/
    );
    const pdfUrl = pdfMatch ? pdfMatch[1] : undefined;

    // arXiv ID from the full URL (handle http/https and optional www)
    const arxivId = id.replace(/^https?:\/\/(?:www\.)?arxiv\.org\/abs\//, "");

    if (title && id) {
      articles.push({
        id: arxivId,
        title,
        authors,
        abstract,
        url: id,
        pdfUrl,
        publishedDate: published,
        source: "arxiv",
      });
    }
  }

  return articles;
}

/**
 * Filter articles by date range.
 */
function filterByDate(
  articles: Article[],
  dateFrom?: string,
  dateTo?: string
): Article[] {
  return articles.filter((a) => {
    const pubDate = new Date(a.publishedDate).getTime();
    if (dateFrom && pubDate < new Date(dateFrom).getTime()) return false;
    if (dateTo && pubDate > new Date(dateTo).getTime()) return false;
    return true;
  });
}

/**
 * Search arXiv for papers matching the given parameters.
 */
export async function searchArxiv(params: SearchParams): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  if (!keywords.length) return [];

  await respectRateLimit();

  const query = buildQuery(keywords);
  // Request extra results when date filtering is needed, so we have enough
  // after filtering.
  const fetchCount = dateFrom || dateTo ? Math.min(maxResults * 3, 60) : maxResults;
  const sortBy = "submittedDate";
  const sortOrder = "descending";

  const url = `${ARXIV_API_URL}?search_query=${query}&start=0&max_results=${fetchCount}&sortBy=${sortBy}&sortOrder=${sortOrder}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  let articles = parseAtomResponse(xml);

  if (dateFrom || dateTo) {
    articles = filterByDate(articles, dateFrom, dateTo);
  }

  return articles.slice(0, maxResults);
}

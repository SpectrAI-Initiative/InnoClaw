/**
 * Paper lookup by (approximate) title for the Paper Study "find by title" box.
 *
 * Semantic Scholar's keyless API is frequently rate limited (HTTP 429) and
 * indexes new preprints with a delay, so a single-source lookup often reported
 * "not found" for papers that exist. This module queries Semantic Scholar and
 * arXiv's title field in parallel, merges the results and ranks them by title
 * similarity so an exact match comes first.
 */

import type { Article } from "./types";
import { buildBioRxivPdfUrl } from "./url-utils";

export const ARXIV_API_URL = "https://export.arxiv.org/api/query";
const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search";

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

/** Max results requested from each source. */
const PER_SOURCE_LIMIT = 10;

/** Max words of the title used for the arXiv title-field query. */
const ARXIV_TITLE_MAX_TERMS = 12;

/**
 * Lucene's English stop words. arXiv's search drops them from its index, so a
 * required `ti:the` / `ti:in` term never matches, and `ti:and` / `ti:or` /
 * `ti:not` collide with boolean operators — any of them zeroes the result set.
 */
const ARXIV_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in",
  "into", "is", "it", "no", "not", "of", "on", "or", "such", "that", "the",
  "their", "then", "there", "these", "they", "this", "to", "was", "will", "with",
]);

// ──────────────────────────────────────────────
// arXiv
// ──────────────────────────────────────────────

export function parseArxivEntries(xml: string): Article[] {
  const articles: Article[] = [];
  const entries = xml.split("<entry>");

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

    if (!title || !id) continue;

    const authorMatches = entry.matchAll(/<author>\s*<name>([^<]+)<\/name>/g);
    const authors = Array.from(authorMatches, (m) => m[1].trim());

    const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/);
    const pdfUrl = pdfMatch ? pdfMatch[1] : undefined;

    const cleanId = id.replace(/^https?:\/\/(?:www\.)?arxiv\.org\/abs\//, "");

    articles.push({
      id: cleanId,
      title,
      authors,
      abstract,
      url: id,
      pdfUrl,
      publishedDate: published,
      source: "arxiv",
    });
  }

  return articles;
}

/** Lower-case, strip punctuation/diacritics and collapse whitespace. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Build an arXiv `search_query` that requires every significant title word
 * (stop words removed) in the title field: `ti:long AND ti:winding AND ...`.
 * Word-wise AND is more forgiving than a quoted phrase with punctuation.
 */
export function buildArxivTitleQuery(title: string): string {
  const terms = normalizeTitle(title)
    .split(" ")
    .filter((w) => w.length > 1 && !ARXIV_STOP_WORDS.has(w))
    .slice(0, ARXIV_TITLE_MAX_TERMS);
  return terms.map((w) => `ti:${w}`).join(" AND ");
}

export async function searchArxivByTitle(title: string): Promise<Article[]> {
  const query = buildArxivTitleQuery(title);
  if (!query) return [];

  const params = new URLSearchParams({
    search_query: query,
    start: "0",
    max_results: String(PER_SOURCE_LIMIT),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ARXIV_API_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`arXiv API error: ${res.status}`);
    }
    return parseArxivEntries(await res.text());
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("arXiv request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// Semantic Scholar
// ──────────────────────────────────────────────

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  authors: { name: string }[];
  year: number | null;
  publicationDate: string | null;
  url: string;
  externalIds: Record<string, string> | null;
  openAccessPdf: { url: string } | null;
}

function detectSourceFromPaper(paper: S2Paper): Article["source"] {
  if (paper.externalIds?.ArXiv) {
    return "arxiv";
  }

  const url = paper.url || "";
  const pdfUrl = paper.openAccessPdf?.url || "";

  if (/biorxiv\.org/i.test(url) || /biorxiv\.org/i.test(pdfUrl)) {
    return "biorxiv";
  }

  if (/pubmed\.ncbi\.nlm\.nih\.gov/i.test(url) || paper.externalIds?.PubMed) {
    return "pubmed";
  }

  return "semantic-scholar";
}

/**
 * Search for papers using the Semantic Scholar Academic Graph API.
 * Free, no API key required. Covers arXiv, ACL, IEEE, PubMed, etc.
 */
export async function searchSemanticScholarByTitle(title: string): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      query: title,
      limit: "10",
      fields: "title,authors,abstract,year,externalIds,url,openAccessPdf,publicationDate",
    });

    const res = await fetch(`${SEMANTIC_SCHOLAR_API}?${params}`, {
      headers: {
        "User-Agent": "notebooklm-paper-study/1.0",
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? "Semantic Scholar rate limited (429)"
          : `Semantic Scholar API error: ${res.status}`
      );
    }

    const data = await res.json();
    const papers: S2Paper[] = data.data || [];

    return papers
      .filter((p) => p.title)
      .map((p) => {
        const arxivId = p.externalIds?.ArXiv;
        const source = detectSourceFromPaper(p);
        const articleUrl =
          arxivId
            ? `https://arxiv.org/abs/${arxivId}`
            : p.url || `https://www.semanticscholar.org/paper/${p.paperId}`;
        const pdfUrl =
          p.openAccessPdf?.url ||
          (arxivId
            ? `https://arxiv.org/pdf/${arxivId}`
            : source === "biorxiv" && articleUrl
              ? buildBioRxivPdfUrl(articleUrl)
              : undefined);

        return {
          id: arxivId || p.paperId,
          title: p.title,
          authors: p.authors?.map((a) => a.name) || [],
          abstract: p.abstract || "",
          url: articleUrl,
          pdfUrl,
          publishedDate: p.publicationDate || (p.year ? `${p.year}` : ""),
          source,
        };
      });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Semantic Scholar request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// Merge & rank
// ──────────────────────────────────────────────

/** Title similarity in [0, 1]; 1 means identical after normalisation. */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(" "));
  const tb = new Set(nb.split(" "));
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  // Dice coefficient on word sets; cap below 1 so exact matches always win.
  return Math.min(0.99, (2 * shared) / (ta.size + tb.size));
}

function arxivIdOf(article: Article): string | null {
  const m = `${article.url} ${article.id}`.match(/(\d{4}\.\d{4,5})(?:v\d+)?/);
  return m ? m[1] : null;
}

/**
 * Merge results from several sources, drop duplicates (same arXiv id or same
 * normalised title, first occurrence wins) and sort by similarity to `query`.
 */
export function mergeAndRankByTitle(query: string, ...lists: Article[][]): Article[] {
  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const list of lists) {
    for (const article of list) {
      const keys = [`t:${normalizeTitle(article.title)}`];
      const arxivId = arxivIdOf(article);
      if (arxivId) keys.push(`a:${arxivId}`);
      if (keys.some((k) => seen.has(k))) continue;
      keys.forEach((k) => seen.add(k));
      merged.push(article);
    }
  }
  return merged
    .map((article, index) => ({ article, index, score: titleSimilarity(query, article.title) }))
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((x) => x.article);
}

export interface TitleLookupResult {
  articles: Article[];
  /** Per-source error messages (only for sources that failed). */
  errors?: Record<string, string>;
  /** True when every source failed, i.e. "not found" cannot be concluded. */
  allSourcesFailed: boolean;
}

export async function lookupPapersByTitle(
  title: string,
  deps: {
    searchSemanticScholar?: (title: string) => Promise<Article[]>;
    searchArxiv?: (title: string) => Promise<Article[]>;
  } = {}
): Promise<TitleLookupResult> {
  const sources = {
    "semantic-scholar": deps.searchSemanticScholar ?? searchSemanticScholarByTitle,
    arxiv: deps.searchArxiv ?? searchArxivByTitle,
  };
  const names = Object.keys(sources) as Array<keyof typeof sources>;
  const settled = await Promise.allSettled(names.map((name) => sources[name](title)));

  const lists: Article[][] = [];
  const errors: Record<string, string> = {};
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      lists.push(result.value);
    } else {
      const reason = result.reason;
      errors[names[i]] = reason instanceof Error ? reason.message : String(reason);
      console.error(`[paper-study/fetch] ${names[i]} title lookup failed:`, errors[names[i]]);
    }
  });

  return {
    articles: mergeAndRankByTitle(title, ...lists),
    errors: Object.keys(errors).length > 0 ? errors : undefined,
    allSourcesFailed: lists.length === 0,
  };
}

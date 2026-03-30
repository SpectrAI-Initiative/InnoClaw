import type { Article, SearchParams } from "./types";

const BIORXIV_API_URL = "https://api.biorxiv.org/details/biorxiv";
const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_LOOKBACK_DAYS = 180;
const MAX_PAGE_REQUESTS = 5;

interface BioRxivEntry {
  title?: string;
  abstract?: string;
  authors?: string;
  doi?: string;
  version?: string;
  date?: string;
}

interface BioRxivResponse {
  collection?: BioRxivEntry[];
}

function buildSearchWindow(dateFrom?: string, dateTo?: string): { from: string; to: string } {
  const to = dateTo || new Date().toISOString().slice(0, 10);
  if (dateFrom) {
    return { from: dateFrom, to };
  }

  const lookback = new Date();
  lookback.setDate(lookback.getDate() - DEFAULT_LOOKBACK_DAYS);
  return {
    from: lookback.toISOString().slice(0, 10),
    to,
  };
}

function splitAuthors(rawAuthors: string | undefined): string[] {
  if (!rawAuthors) return [];
  return rawAuthors
    .split(/;\s*|\s+and\s+/i)
    .map((author) => author.trim())
    .filter(Boolean);
}

function buildBioRxivUrl(doi: string, version?: string): string {
  const suffix = version ? `v${version}` : "";
  return `https://www.biorxiv.org/content/${doi}${suffix}`;
}

function matchesKeywords(entry: BioRxivEntry, keywords: string[]): boolean {
  const haystack = `${entry.title || ""} ${entry.abstract || ""} ${entry.authors || ""}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

export async function searchBioRxiv(params: SearchParams): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  if (keywords.length === 0) return [];

  const { from, to } = buildSearchWindow(dateFrom, dateTo);
  const articles: Article[] = [];

  for (let page = 0, cursor = 0; page < MAX_PAGE_REQUESTS && articles.length < maxResults; page += 1) {
    const res = await fetch(`${BIORXIV_API_URL}/${from}/${to}/${cursor}`, {
      headers: {
        "User-Agent": "notebooklm-paper-study/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`bioRxiv API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as BioRxivResponse;
    const pageEntries = data.collection ?? [];

    if (pageEntries.length === 0) {
      break;
    }

    const pageArticles = pageEntries
      .filter((entry) => entry.title && entry.doi && matchesKeywords(entry, keywords))
      .map((entry) => {
        const url = buildBioRxivUrl(entry.doi!, entry.version);
        return {
          id: entry.doi!,
          title: entry.title!,
          authors: splitAuthors(entry.authors),
          abstract: entry.abstract || "",
          url,
          pdfUrl: `${url}.full.pdf`,
          publishedDate: entry.date || "",
          source: "biorxiv",
        } satisfies Article;
      });

    articles.push(...pageArticles);
    cursor += pageEntries.length;
  }

  return articles.slice(0, maxResults);
}

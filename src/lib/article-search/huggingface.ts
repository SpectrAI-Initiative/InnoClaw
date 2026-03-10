/**
 * Hugging Face Daily Papers client.
 *
 * Uses the Hugging Face API to search for papers from the daily papers feed.
 * @see https://huggingface.co/api/daily_papers
 */

import type { Article, SearchParams } from "./types";

const HF_DEFAULT_URL = "https://huggingface.co/api/daily_papers";

/**
 * Resolve the Hugging Face API URL.
 * If `HF_MIRROR` is set (e.g. `https://hf-mirror.com`), the daily-papers
 * endpoint is derived from it automatically.
 */
function getHfApiUrl(): string {
  const mirror = process.env.HF_MIRROR?.replace(/\/+$/, "");
  if (mirror) {
    return `${mirror}/api/daily_papers`;
  }
  return HF_DEFAULT_URL;
}

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

/** Maximum number of retry attempts for transient network errors. */
const MAX_RETRIES = 1;

/**
 * Fetch daily papers from Hugging Face and filter by keywords and date.
 */
export async function searchHuggingFace(
  params: SearchParams
): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  const apiUrl = getHfApiUrl();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "innoclaw/1.0",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error("Hugging Face API request timed out");
      } else {
        lastError = new Error(
          `Hugging Face API network error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      // Retry on transient network errors
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      lastError = new Error(
        `Hugging Face API error: ${response.status} ${response.statusText}`
      );
      // Retry on server errors (5xx)
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw lastError;
    }

    const data: HFPaper[] = await response.json();
    return filterAndMap(data, keywords, maxResults, dateFrom, dateTo);
  }

  throw lastError ?? new Error("Hugging Face API request failed");
}

/** Filter HF papers by keywords and date, then map to Article[]. */
function filterAndMap(
  data: HFPaper[],
  keywords: string[],
  maxResults: number,
  dateFrom?: string,
  dateTo?: string,
): Article[] {

  // Filter by keywords if provided (case-insensitive, match title or abstract)
  // When no keywords, return all daily papers
  let filtered: HFPaper[];
  if (keywords.length > 0) {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    filtered = data.filter((paper) => {
      const title = (paper.title || "").toLowerCase();
      const abstract = (paper.paper?.summary || "").toLowerCase();
      return lowerKeywords.some(
        (kw) => title.includes(kw) || abstract.includes(kw)
      );
    });
  } else {
    filtered = [...data];
  }

  // Filter by date
  if (dateFrom || dateTo) {
    filtered = filtered.filter((paper) => {
      const pubDate = new Date(
        paper.publishedAt || paper.paper?.publishedAt || ""
      ).getTime();
      if (isNaN(pubDate)) return true; // keep if no date info
      if (dateFrom && pubDate < new Date(dateFrom).getTime()) return false;
      if (dateTo && pubDate > new Date(dateTo).getTime()) return false;
      return true;
    });
  }

  return filtered.slice(0, maxResults).map(toArticle);
}

/** Shape of a Hugging Face Daily Papers API response item. */
interface HFPaper {
  title?: string;
  paper?: {
    id?: string;
    title?: string;
    summary?: string;
    authors?: { name?: string; user?: { fullname?: string } }[];
    publishedAt?: string;
  };
  publishedAt?: string;
}

/** Convert a HF paper to our Article type. */
function toArticle(paper: HFPaper): Article {
  const p = paper.paper;
  const id = p?.id || "";
  const authors =
    p?.authors?.map((a) => a.user?.fullname || a.name || "Unknown") || [];

  return {
    id,
    title: p?.title || paper.title || "",
    authors,
    abstract: p?.summary || "",
    url: id ? `https://huggingface.co/papers/${id}` : "",
    pdfUrl: undefined,
    publishedDate: paper.publishedAt || p?.publishedAt || "",
    source: "huggingface",
  };
}

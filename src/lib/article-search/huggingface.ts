/**
 * Hugging Face Daily Papers client.
 *
 * Uses the Hugging Face API to search for papers from the daily papers feed.
 * @see https://huggingface.co/api/daily_papers
 */

import type { Article, SearchParams } from "./types";

const HF_API_URL = "https://huggingface.co/api/daily_papers";

/**
 * Fetch daily papers from Hugging Face and filter by keywords and date.
 */
export async function searchHuggingFace(
  params: SearchParams
): Promise<Article[]> {
  const { keywords, maxResults = 10, dateFrom, dateTo } = params;

  if (!keywords.length) return [];

  const response = await fetch(HF_API_URL);
  if (!response.ok) {
    throw new Error(
      `Hugging Face API error: ${response.status} ${response.statusText}`
    );
  }

  const data: HFPaper[] = await response.json();

  // Filter by keywords (case-insensitive, match title or abstract)
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  let filtered = data.filter((paper) => {
    const title = (paper.title || "").toLowerCase();
    const abstract = (paper.paper?.summary || "").toLowerCase();
    return lowerKeywords.some(
      (kw) => title.includes(kw) || abstract.includes(kw)
    );
  });

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

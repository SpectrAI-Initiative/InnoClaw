import { NextRequest, NextResponse } from "next/server";
import type { Article } from "@/lib/article-search/types";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";
const HF_API_URL = "https://huggingface.co/api/daily_papers";

/** Common English stopwords to filter out from AND queries. */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can",
  "of", "in", "to", "for", "with", "on", "at", "from", "by",
  "about", "as", "into", "through", "during", "before", "after",
  "above", "below", "between", "and", "but", "or", "nor", "not",
  "so", "yet", "both", "either", "neither", "each", "every",
  "all", "any", "few", "more", "most", "other", "some", "such",
  "no", "only", "own", "same", "than", "too", "very", "just",
  "that", "this", "these", "those", "it", "its", "what", "which",
  "who", "whom", "how", "when", "where", "why", "if", "then",
  "once", "here", "there", "we", "our", "you", "your", "they",
  "their", "he", "she", "his", "her", "my", "me", "us", "them",
]);

/**
 * Parse arXiv Atom XML entries into Article objects.
 */
function parseEntries(xml: string): Article[] {
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

/**
 * Extract arXiv ID from URL or raw ID string.
 */
function extractArxivId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(
    /arxiv\.org\/(?:abs|pdf)\/([0-9]+\.[0-9]+(?:v\d+)?)/i
  );
  if (urlMatch) return urlMatch[1];

  const idMatch = trimmed.match(/^([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)$/);
  if (idMatch) return idMatch[1];

  return null;
}

/** Fetch a single article from arXiv by ID. */
async function fetchArxivById(arxivId: string): Promise<Article | null> {
  const url = `${ARXIV_API_URL}?id_list=${arxivId}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const xml = await response.text();
  if (xml.includes("<title>Error</title>")) return null;

  const articles = parseEntries(xml);
  return articles[0] || null;
}

/**
 * Build significant words from a title (filtering stopwords and short tokens).
 */
function getSignificantWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Compute a simple relevance score between query words and text.
 * Returns a value between 0 and 1 based on word overlap.
 */
function computeRelevance(queryWords: string[], text: string): number {
  const textWords = new Set(getSignificantWords(text));
  if (textWords.size === 0 || queryWords.length === 0) return 0;
  let matches = 0;
  for (const w of queryWords) {
    if (textWords.has(w)) matches++;
  }
  return matches / queryWords.length;
}

/**
 * Search arXiv by paper title and return candidate matches.
 *
 * Strategy:
 * 1. Exact phrase search: ti:"full title" — best for known titles
 * 2. OR keyword search on title: ti:word1 OR ti:word2 — fuzzy title match
 * 3. OR keyword search on all fields: all:word1 OR all:word2 — broadest search
 * Results are sorted by relevance (word overlap) then by recency.
 */
async function searchArxivByTitle(title: string): Promise<Article[]> {
  const words = getSignificantWords(title);

  // --- Pass 1: exact phrase match ---
  const quotedQuery = `ti:"${title}"`;
  const url1 = `${ARXIV_API_URL}?search_query=${encodeURIComponent(quotedQuery)}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;

  const res1 = await fetch(url1);
  if (res1.ok) {
    const xml1 = await res1.text();
    const articles1 = parseEntries(xml1);
    if (articles1.length > 0) return articles1;
  }

  if (words.length === 0) return [];

  // --- Pass 2: OR of significant words on title ---
  const orTitleQuery = words.map((w) => `ti:${w}`).join("+OR+");
  const url2 = `${ARXIV_API_URL}?search_query=${orTitleQuery}&start=0&max_results=20&sortBy=relevance&sortOrder=descending`;

  const res2 = await fetch(url2);
  let titleResults: Article[] = [];
  if (res2.ok) {
    const xml2 = await res2.text();
    titleResults = parseEntries(xml2);
  }

  // --- Pass 3: OR of significant words on all fields (title + abstract + authors) ---
  const orAllQuery = words.map((w) => `all:${w}`).join("+OR+");
  const url3 = `${ARXIV_API_URL}?search_query=${orAllQuery}&start=0&max_results=15&sortBy=relevance&sortOrder=descending`;

  const res3 = await fetch(url3);
  let allResults: Article[] = [];
  if (res3.ok) {
    const xml3 = await res3.text();
    allResults = parseEntries(xml3);
  }

  // Merge and deduplicate
  const seen = new Set<string>();
  const merged: Article[] = [];
  for (const a of [...titleResults, ...allResults]) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      merged.push(a);
    }
  }

  if (merged.length === 0) return [];

  // Sort by relevance (word overlap with title+abstract) descending, then by date (newest first)
  const lowerInput = title.toLowerCase().replace(/\s+/g, " ").trim();
  merged.sort((a, b) => {
    // Exact title match always comes first
    const aExact = a.title.toLowerCase().replace(/\s+/g, " ").trim() === lowerInput ? 1 : 0;
    const bExact = b.title.toLowerCase().replace(/\s+/g, " ").trim() === lowerInput ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    // Then by combined relevance (title weight 0.7, abstract weight 0.3)
    const aRel = computeRelevance(words, a.title) * 0.7 + computeRelevance(words, a.abstract) * 0.3;
    const bRel = computeRelevance(words, b.title) * 0.7 + computeRelevance(words, b.abstract) * 0.3;
    if (Math.abs(aRel - bRel) > 0.05) return bRel - aRel;

    // Then by date (newest first)
    const aDate = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
    const bDate = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
    return bDate - aDate;
  });

  return merged;
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
function hfToArticle(paper: HFPaper): Article {
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

/**
 * Search HuggingFace Daily Papers by title keywords (fuzzy match).
 */
async function searchHuggingFaceByTitle(title: string): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(HF_API_URL, {
      headers: { "User-Agent": "innoclaw/1.0", Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) return [];

    const data: HFPaper[] = await response.json();
    const queryWords = getSignificantWords(title);
    if (queryWords.length === 0) return [];

    // Fuzzy match: any query word appears in title or abstract
    const matched = data.filter((paper) => {
      const paperTitle = (paper.paper?.title || paper.title || "").toLowerCase();
      const paperAbstract = (paper.paper?.summary || "").toLowerCase();
      const combined = paperTitle + " " + paperAbstract;
      return queryWords.some((w) => combined.includes(w));
    });

    // Convert to Article and compute relevance
    const articles = matched.map(hfToArticle);

    // Sort by relevance then recency
    articles.sort((a, b) => {
      const aRel = computeRelevance(queryWords, a.title) * 0.7 + computeRelevance(queryWords, a.abstract) * 0.3;
      const bRel = computeRelevance(queryWords, b.title) * 0.7 + computeRelevance(queryWords, b.abstract) * 0.3;
      if (Math.abs(aRel - bRel) > 0.05) return bRel - aRel;

      const aDate = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
      const bDate = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
      return bDate - aDate;
    });

    return articles.slice(0, 15);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Merge articles from multiple sources, deduplicating by arXiv ID.
 * arXiv articles take priority over HF articles with the same ID.
 */
function mergeAndDeduplicate(arxivArticles: Article[], hfArticles: Article[]): Article[] {
  const seen = new Set<string>();
  const result: Article[] = [];

  // arXiv results first (higher priority)
  for (const a of arxivArticles) {
    const normalizedId = a.id.replace(/v\d+$/, "");
    if (!seen.has(normalizedId)) {
      seen.add(normalizedId);
      result.push(a);
    }
  }

  // Then HF results
  for (const a of hfArticles) {
    const normalizedId = a.id.replace(/v\d+$/, "");
    if (!seen.has(normalizedId)) {
      seen.add(normalizedId);
      result.push(a);
    }
  }

  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = (body.title || body.url || "").trim();

    if (!input) {
      return NextResponse.json(
        { error: "MISSING_INPUT" },
        { status: 400 }
      );
    }

    // 1. Try as arXiv URL or raw ID
    const arxivId = extractArxivId(input);
    if (arxivId) {
      const article = await fetchArxivById(arxivId);
      if (!article) {
        return NextResponse.json(
          { error: "NOT_FOUND" },
          { status: 404 }
        );
      }
      return NextResponse.json({ articles: [article] });
    }

    // 2. Try as HuggingFace URL
    const hfMatch = input.match(/huggingface\.co\/papers\/([0-9]+\.[0-9]+)/i);
    if (hfMatch) {
      const article = await fetchArxivById(hfMatch[1]);
      if (article) {
        return NextResponse.json({
          articles: [{ ...article, url: `https://huggingface.co/papers/${hfMatch[1]}` }],
        });
      }
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 3. Search both arXiv and HuggingFace in parallel
    const [arxivArticles, hfArticles] = await Promise.all([
      searchArxivByTitle(input),
      searchHuggingFaceByTitle(input),
    ]);

    const articles = mergeAndDeduplicate(arxivArticles, hfArticles);

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Final sort: relevance then recency across all sources
    const queryWords = getSignificantWords(input);
    articles.sort((a, b) => {
      const aRel = computeRelevance(queryWords, a.title) * 0.7 + computeRelevance(queryWords, a.abstract) * 0.3;
      const bRel = computeRelevance(queryWords, b.title) * 0.7 + computeRelevance(queryWords, b.abstract) * 0.3;
      if (Math.abs(aRel - bRel) > 0.05) return bRel - aRel;

      const aDate = a.publishedDate ? new Date(a.publishedDate).getTime() : 0;
      const bDate = b.publishedDate ? new Date(b.publishedDate).getTime() : 0;
      return bDate - aDate;
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Paper fetch error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

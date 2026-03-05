import { NextRequest, NextResponse } from "next/server";
import type { Article } from "@/lib/article-search/types";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";

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
 * Search arXiv by paper title and return candidate matches.
 *
 * Strategy:
 * 1. Exact phrase search: ti:"full title" — best for known titles
 * 2. AND keyword search: ti:word1 AND ti:word2 AND ... — fallback for partial titles
 */
async function searchArxivByTitle(title: string): Promise<Article[]> {
  // --- Pass 1: exact phrase match ---
  const quotedQuery = `ti:"${title}"`;
  const url1 = `${ARXIV_API_URL}?search_query=${encodeURIComponent(quotedQuery)}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;

  const res1 = await fetch(url1);
  if (res1.ok) {
    const xml1 = await res1.text();
    const articles1 = parseEntries(xml1);
    if (articles1.length > 0) return articles1;
  }

  // --- Pass 2: AND of significant words ---
  const words = getSignificantWords(title);
  if (words.length === 0) return [];

  const andQuery = words.map((w) => `ti:${w}`).join("+AND+");
  const url2 = `${ARXIV_API_URL}?search_query=${andQuery}&start=0&max_results=10&sortBy=relevance&sortOrder=descending`;

  const res2 = await fetch(url2);
  if (!res2.ok) return [];

  const xml2 = await res2.text();
  const articles2 = parseEntries(xml2);

  if (articles2.length === 0) return [];

  // Sort: exact title match first, then by relevance (API order)
  const lowerInput = title.toLowerCase().replace(/\s+/g, " ").trim();
  articles2.sort((a, b) => {
    const aExact = a.title.toLowerCase().replace(/\s+/g, " ").trim() === lowerInput ? 0 : 1;
    const bExact = b.title.toLowerCase().replace(/\s+/g, " ").trim() === lowerInput ? 0 : 1;
    return aExact - bExact;
  });

  return articles2;
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

    // 3. Treat as paper title — search arXiv by title
    const articles = await searchArxivByTitle(input);
    if (articles.length === 0) {
      return NextResponse.json(
        { error: "NOT_FOUND" },
        { status: 404 }
      );
    }
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Paper fetch error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

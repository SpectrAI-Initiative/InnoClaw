import { NextRequest, NextResponse } from "next/server";
import type { Article } from "@/lib/article-search/types";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";
const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search";
/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

// ──────────────────────────────────────────────
// arXiv helpers
// ──────────────────────────────────────────────

function parseArxivEntries(xml: string): Article[] {
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

async function fetchArxivById(arxivId: string): Promise<Article | null> {
  const url = `${ARXIV_API_URL}?id_list=${arxivId}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const xml = await response.text();
  if (xml.includes("<title>Error</title>")) return null;

  const articles = parseArxivEntries(xml);
  return articles[0] || null;
}

/**
 * Search arXiv by paper title using the ti: (title) field.
 * This is much more reliable than Semantic Scholar for finding arxiv papers.
 */
async function searchArxivByTitle(title: string): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Use ti: field for title-specific search. Wrap in quotes for phrase match.
    const query = `ti:"${title}"`;
    const params = new URLSearchParams({
      search_query: query,
      start: "0",
      max_results: "10",
      sortBy: "relevance",
      sortOrder: "descending",
    });

    const res = await fetch(`${ARXIV_API_URL}?${params}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`arXiv search API error: ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseArxivEntries(xml);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("arXiv title search timed out");
    } else {
      console.error("arXiv title search error:", err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// Semantic Scholar search (for title-based lookup)
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

async function searchByTitle(title: string): Promise<Article[]> {
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
      console.error(`Semantic Scholar API error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const papers: S2Paper[] = data.data || [];

    return papers
      .filter((p) => p.title)
      .map((p) => {
        const arxivId = p.externalIds?.ArXiv;
        const pdfUrl =
          p.openAccessPdf?.url ||
          (arxivId ? `https://arxiv.org/pdf/${arxivId}` : undefined);
        const articleUrl =
          arxivId
            ? `https://arxiv.org/abs/${arxivId}`
            : p.url || `https://www.semanticscholar.org/paper/${p.paperId}`;

        return {
          id: arxivId || p.paperId,
          title: p.title,
          authors: p.authors?.map((a) => a.name) || [],
          abstract: p.abstract || "",
          url: articleUrl,
          pdfUrl,
          publishedDate: p.publicationDate || (p.year ? `${p.year}` : ""),
          source: "arxiv" as const,
        };
      });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("Semantic Scholar API request timed out");
    } else {
      console.error("Semantic Scholar API error:", err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ──────────────────────────────────────────────
// Google search — direct HTML scraping (no API key needed)
// ──────────────────────────────────────────────

/**
 * Extract URLs from Google search result HTML.
 * Google embeds result links in <a> tags with href="/url?q=<actual-url>&...".
 */
function extractGoogleResultUrls(html: string): string[] {
  const urls: string[] = [];
  // Match Google's redirect links: /url?q=<encoded-url>&sa=...
  const regex = /\/url\?q=(https?:\/\/[^&"]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const decoded = decodeURIComponent(match[1]);
    // Skip Google's own pages and tracking URLs
    if (
      decoded.includes("google.com") ||
      decoded.includes("googleapis.com") ||
      decoded.includes("accounts.google") ||
      decoded.includes("support.google")
    ) {
      continue;
    }
    urls.push(decoded);
  }
  return urls;
}

/**
 * Extract a simple text snippet from Google result HTML for a given URL.
 */
function extractSnippet(html: string, url: string): string {
  // Find the region around the URL and look for nearby text
  const idx = html.indexOf(url);
  if (idx === -1) return "";
  // Take a chunk after the URL reference and try to extract visible text
  const chunk = html.slice(idx, idx + 2000);
  // Remove HTML tags and get the first meaningful text
  const text = chunk
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Return first ~300 chars
  return text.slice(0, 300);
}

/**
 * Search Google directly by fetching the HTML results page.
 * No API key required. Prefers arxiv.org results.
 *
 * Falls back gracefully if Google blocks the request (returns []).
 */
async function searchViaGoogle(title: string): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // First try with site restriction to prefer academic sources
    const query = encodeURIComponent(
      `"${title}" site:arxiv.org OR site:semanticscholar.org OR site:openreview.net`
    );
    const googleUrl = `https://www.google.com/search?q=${query}&num=10&hl=en`;

    const res = await fetch(googleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`Google search returned ${res.status}`);
      // If site-restricted search fails, try broader search
      return searchViaGoogleBroad(title, controller.signal);
    }

    const html = await res.text();
    const urls = extractGoogleResultUrls(html);

    // If no results with site restriction, try broader search
    if (urls.length === 0) {
      return searchViaGoogleBroad(title, controller.signal);
    }

    return resolveUrlsToArticles(urls, html);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("Google search timed out");
    } else {
      console.error("Google search error:", err);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Broader Google search without site restriction.
 */
async function searchViaGoogleBroad(
  title: string,
  signal: AbortSignal
): Promise<Article[]> {
  try {
    const query = encodeURIComponent(`"${title}" paper arxiv`);
    const googleUrl = `https://www.google.com/search?q=${query}&num=10&hl=en`;

    const res = await fetch(googleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal,
    });

    if (!res.ok) {
      console.error(`Google broad search returned ${res.status}`);
      return [];
    }

    const html = await res.text();
    const urls = extractGoogleResultUrls(html);
    return resolveUrlsToArticles(urls, html);
  } catch (err) {
    console.error("Google broad search error:", err);
    return [];
  }
}

/**
 * Given a list of URLs from Google results, sort by priority (arxiv first),
 * extract arXiv IDs, and fetch full metadata from arXiv API.
 * For non-arxiv URLs, create a basic article entry from the search snippet.
 */
async function resolveUrlsToArticles(
  urls: string[],
  html: string
): Promise<Article[]> {
  // Sort: arxiv > semanticscholar > openreview > others
  const sorted = [...urls].sort((a, b) => {
    const score = (u: string) =>
      u.includes("arxiv.org")
        ? 0
        : u.includes("semanticscholar.org")
          ? 1
          : u.includes("openreview.net")
            ? 2
            : 3;
    return score(a) - score(b);
  });

  const articles: Article[] = [];
  const seenIds = new Set<string>();

  for (const url of sorted) {
    if (articles.length >= 5) break;

    // Try to extract arXiv ID
    const arxivIdMatch = url.match(
      /arxiv\.org\/(?:abs|pdf|html)\/([0-9]+\.[0-9]+(?:v\d+)?)/i
    );

    if (arxivIdMatch) {
      const arxivId = arxivIdMatch[1];
      if (seenIds.has(arxivId)) continue;
      seenIds.add(arxivId);

      const article = await fetchArxivById(arxivId);
      if (article) {
        articles.push(article);
        continue;
      }
    }

    // For non-arxiv results, create a basic article from the search info
    if (seenIds.has(url)) continue;
    seenIds.add(url);

    const snippet = extractSnippet(html, url);
    // Extract a cleaner title from the URL path or snippet
    const pathTitle = url
      .split("/")
      .pop()
      ?.replace(/[-_]/g, " ")
      ?.replace(/\.\w+$/, "") || "";

    articles.push({
      id: url,
      title: pathTitle || url,
      authors: [],
      abstract: snippet,
      url,
      pdfUrl: undefined,
      publishedDate: "",
      source: "arxiv",
    });
  }

  return articles;
}

// ──────────────────────────────────────────────
// Route handler
// ──────────────────────────────────────────────

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

    // 1. Try as arXiv URL or raw ID → direct fetch
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

    // 2. Try as HuggingFace URL → extract arXiv ID
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

    // 3. Multi-strategy title search:
    //    a) arXiv title search (most reliable for arxiv papers)
    //    b) Semantic Scholar (broader coverage)
    //    c) Google search via Serper API (final fallback)

    // Strategy A: arXiv title search
    console.log(`[fetch] Searching arXiv by title: "${input}"`);
    const arxivResults = await searchArxivByTitle(input);
    if (arxivResults.length > 0) {
      return NextResponse.json({ articles: arxivResults });
    }

    // Strategy B: Semantic Scholar
    console.log(`[fetch] arXiv title search returned 0 results, trying Semantic Scholar...`);
    const s2Results = await searchByTitle(input);
    if (s2Results.length > 0) {
      return NextResponse.json({ articles: s2Results });
    }

    // Strategy C: Google search via Serper API
    console.log(`[fetch] Semantic Scholar returned 0 results, trying Google search...`);
    const googleResults = await searchViaGoogle(input);
    if (googleResults.length > 0) {
      return NextResponse.json({ articles: googleResults });
    }

    return NextResponse.json(
      { error: "NOT_FOUND" },
      { status: 404 }
    );
  } catch (error) {
    console.error("Paper fetch error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

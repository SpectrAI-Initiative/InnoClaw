import { NextRequest, NextResponse } from "next/server";
import type { Article } from "@/lib/article-search/types";

const ARXIV_API_URL = "https://export.arxiv.org/api/query";
const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search";

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 15_000;

// ──────────────────────────────────────────────
// arXiv helpers (for direct URL / ID lookup)
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

/**
 * Search for papers using the Semantic Scholar Academic Graph API.
 * Free, no API key required. Covers arXiv, ACL, IEEE, PubMed, etc.
 */
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
          source: "arxiv" as const, // display as arxiv if has arxiv id
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
// Route handler
// ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = (body.title || body.url || "").trim();

    if (!input) {
      return NextResponse.json(
        { error: "请输入论文名称或 arXiv ID" },
        { status: 400 }
      );
    }

    // 1. Try as arXiv URL or raw ID → direct fetch
    const arxivId = extractArxivId(input);
    if (arxivId) {
      const article = await fetchArxivById(arxivId);
      if (!article) {
        return NextResponse.json(
          { error: "在 arXiv 上未找到该论文" },
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
        { error: "在 arXiv 上未找到该论文" },
        { status: 404 }
      );
    }

    // 3. Treat as paper title → Semantic Scholar search
    const articles = await searchByTitle(input);
    if (articles.length === 0) {
      return NextResponse.json(
        { error: `未找到标题匹配的论文: "${input}"` },
        { status: 404 }
      );
    }
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Paper fetch error:", error);
    const message =
      error instanceof Error ? error.message : "获取论文失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

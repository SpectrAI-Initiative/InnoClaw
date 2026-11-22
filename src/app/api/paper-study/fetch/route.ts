import { NextRequest, NextResponse } from "next/server";
import type { Article } from "@/lib/article-search/types";
import {
  ARXIV_API_URL,
  lookupPapersByTitle,
  parseArxivEntries,
} from "@/lib/article-search/title-lookup";

// ──────────────────────────────────────────────
// arXiv helpers (for direct URL / ID lookup)
// ──────────────────────────────────────────────

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

    // 3. Treat as paper title → Semantic Scholar + arXiv title search in parallel
    const { articles, errors, allSourcesFailed } = await lookupPapersByTitle(input);
    if (articles.length === 0) {
      return NextResponse.json(
        allSourcesFailed
          ? { error: "UPSTREAM_UNAVAILABLE", errors }
          : { error: "NOT_FOUND" },
        { status: allSourcesFailed ? 502 : 404 }
      );
    }

    return NextResponse.json({ articles, errors });
  } catch (error) {
    console.error("Paper fetch error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

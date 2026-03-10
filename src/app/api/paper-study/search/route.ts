import { NextRequest, NextResponse } from "next/server";
import { searchArticles } from "@/lib/article-search";
import type { ArticleSource } from "@/lib/article-search";

const VALID_SOURCES = new Set<string>(["arxiv", "huggingface", "semantic-scholar"]);

export async function POST(req: NextRequest) {
  try {
    const { keywords, maxResults, dateFrom, dateTo, sources } = await req.json();

    const keywordList = Array.isArray(keywords) ? keywords : [];

    // Validate requested sources
    const requestedSources: ArticleSource[] | undefined = Array.isArray(sources)
      ? sources.filter((s: string) => VALID_SOURCES.has(s)) as ArticleSource[]
      : undefined;

    // When no keywords, only HuggingFace daily papers work (arXiv/semantic-scholar require keywords)
    const effectiveSources: ArticleSource[] | undefined = keywordList.length === 0
      ? ["huggingface"]
      : (requestedSources && requestedSources.length > 0 ? requestedSources : undefined);

    if (keywordList.length === 0 && effectiveSources?.every(s => s !== "huggingface")) {
      return NextResponse.json(
        { error: "Keywords are required for arXiv search" },
        { status: 400 }
      );
    }

    const result = await searchArticles({
      keywords: keywordList,
      maxResults: typeof maxResults === "number" ? Math.min(maxResults, 30) : 10,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sources: effectiveSources,
    });

    // Always return 200 even with partial errors — articles from successful sources
    // are still useful. The `errors` field lets the client show warnings.
    return NextResponse.json(result);
  } catch (error) {
    console.error("Paper study search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

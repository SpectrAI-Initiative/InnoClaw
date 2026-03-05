import { NextRequest, NextResponse } from "next/server";
import { searchArticles } from "@/lib/article-search";
import type { ArticleSource } from "@/lib/article-search";

export async function POST(req: NextRequest) {
  try {
    const { keywords, maxResults, dateFrom, dateTo, sources } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: "At least one keyword is required" },
        { status: 400 }
      );
    }

    const validSources: ArticleSource[] | undefined = Array.isArray(sources)
      ? sources.filter(
          (s: unknown): s is ArticleSource => s === "arxiv" || s === "huggingface"
        )
      : undefined;

    const result = await searchArticles({
      keywords,
      maxResults: typeof maxResults === "number" ? Math.min(maxResults, 30) : 10,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sources: validSources && validSources.length > 0 ? validSources : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Paper study search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

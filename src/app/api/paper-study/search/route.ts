import { NextRequest, NextResponse } from "next/server";
import { searchArticles } from "@/lib/article-search";
import type { ArticleSource } from "@/lib/article-search";

export async function POST(req: NextRequest) {
  try {
    const { keywords, maxResults, dateFrom, dateTo, sources } = await req.json();

    const keywordList = Array.isArray(keywords) ? keywords : [];

    // When no keywords, only search HuggingFace daily papers (arXiv requires keywords)
    const requestedSources: ArticleSource[] | undefined = sources?.filter(
      (s: string) => s === "arxiv" || s === "huggingface"
    );
    const effectiveSources = keywordList.length === 0
      ? (requestedSources?.includes("huggingface") ? ["huggingface"] as ArticleSource[] : ["huggingface"] as ArticleSource[])
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("Paper study search error:", error);
    const message =
      error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

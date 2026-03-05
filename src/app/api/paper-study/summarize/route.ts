import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildPaperSummarizationPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const { articles } = await req.json();

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: "At least one article is required" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local." },
        { status: 503 }
      );
    }

    const model = await getConfiguredModel();

    // Limit to first 15 articles and truncate abstracts to avoid exceeding context
    const trimmedArticles = articles.slice(0, 15).map((a: Record<string, unknown>) => ({
      title: String(a.title || ""),
      authors: Array.isArray(a.authors) ? a.authors.map(String) : [],
      publishedDate: String(a.publishedDate || ""),
      source: String(a.source || ""),
      abstract: String(a.abstract || "").slice(0, 1500),
    }));

    const systemPrompt = buildPaperSummarizationPrompt(trimmedArticles);

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: "Please analyze and summarize all the papers listed above.",
      abortSignal: req.signal,
    });

    return NextResponse.json({ summary: text });
  } catch (error) {
    console.error("Paper study summarize error:", error);
    const message =
      error instanceof Error ? error.message : "Summarization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

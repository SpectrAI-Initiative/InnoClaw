import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildPaperRoastPrompt } from "@/lib/ai/prompts";

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

    const systemPrompt = buildPaperRoastPrompt(trimmedArticles);

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: "请对以上所有论文进行今日锐评，按照要求的格式输出分流表和逐篇详评。",
    });

    return NextResponse.json({ roast: text });
  } catch (error) {
    console.error("Paper study roast error:", error);
    const message =
      error instanceof Error ? error.message : "Roast generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

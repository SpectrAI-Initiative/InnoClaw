import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildPaperRoastPrompt } from "@/lib/ai/prompts";
import { trimArticlesForLLM } from "@/lib/ai/paper-utils";
import { jsonError } from "@/lib/api-errors";

export async function POST(req: NextRequest) {
  try {
    const { articles } = await req.json();

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return jsonError("At least one article is required", 400);
    }

    if (!isAIAvailable()) {
      return jsonError("AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.", 503);
    }

    const model = await getConfiguredModel();

    const trimmedArticles = trimArticlesForLLM(articles);

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
    return jsonError(message, 500);
  }
}

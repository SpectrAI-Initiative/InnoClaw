import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { buildPaperRoastPrompt } from "@/lib/ai/prompts";
import { trimArticlesForLLM } from "@/lib/ai/paper-utils";
import { jsonError } from "@/lib/api-errors";
import { filterAndRankPapers } from "@/lib/paper-study/scoring";
import { loadConfig } from "@/lib/paper-study/config";

export async function POST(req: NextRequest) {
  try {
    const { articles, llmProvider, llmModel, useScoring } = await req.json();

    if (!articles || !Array.isArray(articles) || articles.length === 0) {
      return jsonError("At least one article is required", 400);
    }

    if (!isAIAvailable()) {
      return jsonError("AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.", 503);
    }

    const { model } = llmProvider && llmModel
      ? getModelFromOverride(llmProvider, llmModel)
      : { model: await getConfiguredModel() };

    // Optionally apply scoring and filtering
    let processedArticles = articles;
    if (useScoring !== false) {
      try {
        const config = await loadConfig();
        const scored = filterAndRankPapers(articles, config.daily_papers);
        if (scored.length > 0) {
          processedArticles = scored;
        }
      } catch {
        // Scoring failed — proceed with unscored articles
      }
    }

    const trimmedArticles = trimArticlesForLLM(processedArticles);

    // Carry over score and upvotes for the prompt
    const articlesWithScores = trimmedArticles.map((a, i) => ({
      ...a,
      score: processedArticles[i]?.score as number | undefined,
      upvotes: processedArticles[i]?.upvotes as number | undefined,
    }));

    const systemPrompt = buildPaperRoastPrompt(articlesWithScores);

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: "请对以上所有论文进行今日锐评，按照要求的格式输出分流表和逐篇详评。",
      maxOutputTokens: 8192,
      abortSignal: req.signal,
    });

    return NextResponse.json({
      roast: text,
      totalArticles: articles.length,
      scoredArticles: processedArticles.length,
    });
  } catch (error) {
    console.error("Paper study roast error:", error);
    const message =
      error instanceof Error ? error.message : "Roast generation failed";
    return jsonError(message, 500);
  }
}

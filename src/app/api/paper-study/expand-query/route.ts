import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { buildQueryExpansionPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const { question, llmProvider, llmModel } = await req.json();

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "A non-empty question is required" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local." },
        { status: 503 }
      );
    }

    const { model } = llmProvider && llmModel
      ? getModelFromOverride(llmProvider, llmModel)
      : { model: await getConfiguredModel() };
    const systemPrompt = buildQueryExpansionPrompt();

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: question.trim(),
      abortSignal: req.signal,
    });

    // Parse the JSON response from the LLM
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const keywords: string[] = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k: unknown) => typeof k === "string" && k.trim())
      : [];
    const query: string = typeof parsed.query === "string" ? parsed.query.trim() : question.trim();

    if (keywords.length === 0) {
      return NextResponse.json(
        { error: "AI could not extract keywords from the question" },
        { status: 500 }
      );
    }

    return NextResponse.json({ keywords, query });
  } catch (error) {
    console.error("Query expansion error:", error);
    const message =
      error instanceof Error ? error.message : "Query expansion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

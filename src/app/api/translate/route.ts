import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  try {
    const { texts, targetLanguage } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0 || !targetLanguage) {
      return NextResponse.json(
        { error: "Missing texts array or targetLanguage" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured. Please set API keys in settings." },
        { status: 503 }
      );
    }

    const model = await getConfiguredModel();

    const numbered = texts
      .map((t: string, i: number) => `[${i}] ${t}`)
      .join("\n");

    const { text: result } = await generateText({
      model,
      system: `You are a professional translator. Translate each numbered line to ${targetLanguage}. Keep the [N] prefix for each line. Only output translations, no explanations. If a line is empty or "—", keep it as is.`,
      prompt: numbered,
      abortSignal: req.signal,
    });

    // Parse numbered results back
    const translations: string[] = new Array(texts.length).fill("");
    for (const line of result.split("\n")) {
      const match = line.match(/^\[(\d+)\]\s*(.*)/);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx >= 0 && idx < texts.length) {
          translations[idx] = match[2].trim();
        }
      }
    }

    return NextResponse.json({ translations });
  } catch (error) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}

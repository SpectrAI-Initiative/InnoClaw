import { NextRequest } from "next/server";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { runFullIdeation } from "@/lib/research-ideation/orchestrator";
import { textError } from "@/lib/api-errors";
import type { IdeationSharedContext, IdeationTurn } from "@/lib/research-ideation/types";

export async function POST(req: NextRequest) {
  try {
    const { article, mode = "quick", locale = "en", userSeed } = await req.json();

    if (!article || !article.title) {
      return textError("Missing article data", 400);
    }

    if (mode !== "quick" && mode !== "full") {
      return textError("Invalid mode, must be 'quick' or 'full'", 400);
    }

    if (!isAIAvailable()) {
      return textError(
        "AI is not configured. Please set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or SHLAB_API_KEY in .env.local.",
        503,
      );
    }

    const model = await getConfiguredModel();

    const context: IdeationSharedContext = {
      article: {
        id: article.id || "",
        title: article.title,
        authors: Array.isArray(article.authors) ? article.authors : [],
        publishedDate: article.publishedDate || "",
        source: article.source || "",
        abstract: article.abstract || "",
      },
      userSeed: userSeed || undefined,
      locale,
      mode,
    };

    // Stream each completed turn as a JSON line
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runFullIdeation(
            context,
            model,
            (turn: IdeationTurn) => {
              controller.enqueue(encoder.encode(JSON.stringify(turn) + "\n"));
            },
            req.signal,
          );
          controller.close();
        } catch (error) {
          if (req.signal.aborted) {
            controller.close();
            return;
          }
          console.error("Research ideation error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Research ideation error:", error);
    return textError(
      error instanceof Error ? error.message : "Ideation failed",
      500,
    );
  }
}

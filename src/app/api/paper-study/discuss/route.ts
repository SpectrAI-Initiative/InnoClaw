import { NextRequest } from "next/server";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { runFullPaperDiscussion } from "@/lib/paper-discussion/orchestrator";
import { extractPaperFullText } from "../extract-paper-text";
import type { PaperDiscussionSharedContext, DiscussionTurn } from "@/lib/paper-discussion/types";

export async function POST(req: NextRequest) {
  try {
    const { article, mode = "quick", locale = "en" } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    if (mode !== "quick" && mode !== "full") {
      return new Response("Invalid mode, must be 'quick' or 'full'", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or SHLAB_API_KEY in .env.local.",
        { status: 503 },
      );
    }

    const model = await getConfiguredModel();

    const context: PaperDiscussionSharedContext = {
      article: {
        id: article.id || "",
        title: article.title,
        authors: Array.isArray(article.authors) ? article.authors : [],
        publishedDate: article.publishedDate || "",
        source: article.source || "",
        abstract: article.abstract || "",
      },
      locale,
      mode,
    };

    // Extract full paper text for deeper analysis (local files only)
    const paperText = await extractPaperFullText(article, 30_000);
    if (paperText) {
      context.retrievedEvidence = paperText;
    }

    // Stream each completed turn as a JSON line
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await runFullPaperDiscussion(
            context,
            model,
            (turn: DiscussionTurn) => {
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
          console.error("Paper discussion error:", error);
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
    console.error("Paper discussion error:", error);
    return new Response(
      error instanceof Error ? error.message : "Discussion failed",
      { status: 500 },
    );
  }
}

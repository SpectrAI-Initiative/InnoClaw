import { NextRequest } from "next/server";
import { getConfiguredModelWithProvider, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { providerSupportsVision } from "@/lib/ai/models";
import { runFullIdeation } from "@/lib/research-ideation/orchestrator";
import { extractPaperContent, extractPaperFullText } from "../extract-paper-content";
import { textError } from "@/lib/api-errors";
import type { IdeationSharedContext, IdeationTurn } from "@/lib/research-ideation/types";

export async function POST(req: NextRequest) {
  try {
    const { article, mode = "quick", locale = "en", userSeed, llmProvider, llmModel } = await req.json();

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

    let providerId: string;
    let model;
    if (llmProvider && llmModel) {
      const override = getModelFromOverride(llmProvider, llmModel);
      model = override.model;
      providerId = llmProvider;
    } else {
      const configured = await getConfiguredModelWithProvider();
      model = configured.model;
      providerId = configured.providerId;
    }
    const visionCapable = providerSupportsVision(providerId);

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
      supportsVision: visionCapable,
      locale,
      mode,
    };

    // Extract paper content — with images for vision-capable providers
    if (visionCapable) {
      const paperContent = await extractPaperContent(article, true, 20);
      if (paperContent) {
        context.paperContent = paperContent;
        const textOnly = paperContent
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n\n");
        if (textOnly.length > 0) {
          context.retrievedEvidence = textOnly.slice(0, 30_000);
        }
      }
    } else {
      const paperText = await extractPaperFullText(article, 30_000);
      if (paperText) {
        context.retrievedEvidence = paperText;
      }
    }

    // Stream each completed turn as a JSON line
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit paper page images as initial metadata line
          if (context.paperContent) {
            const pages = context.paperContent
              .filter((p) => p.type === "image")
              .map((p) => ({ pageNumber: p.pageNumber, data: p.data, mimeType: p.mimeType }));
            if (pages.length > 0) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: "paper_pages", pages }) + "\n"));
            }
          }

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

import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getConfiguredModel, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { buildPaperQuickSummaryPrompt } from "@/lib/ai/paper-prompts";
import { extractPaperFullContent } from "../extract-paper-text";

export async function POST(req: NextRequest) {
  try {
    const { article, llmProvider, llmModel } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or SHLAB_API_KEY in .env.local.",
        { status: 503 },
      );
    }

    const { model } = llmProvider && llmModel
      ? getModelFromOverride(llmProvider, llmModel)
      : { model: await getConfiguredModel() };

    // Extract full paper text and figures
    const articleRef = {
      id: article.id || "",
      url: article.url || "",
      pdfUrl: article.pdfUrl,
      source: article.source || "",
    };
    const paperContent = await extractPaperFullContent(articleRef, 30_000);

    // Use full text if available, otherwise fall back to abstract
    const fullText = paperContent.fullText || article.abstract || "";
    if (!fullText) {
      return new Response(
        JSON.stringify({ error: "no_full_text" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    const figures = paperContent.figures || [];

    const systemPrompt = buildPaperQuickSummaryPrompt(
      {
        title: article.title,
        authors: Array.isArray(article.authors) ? article.authors : [],
        publishedDate: article.publishedDate || "",
        source: article.source || "",
        abstract: article.abstract || "",
      },
      paperContent.fullText || article.abstract || "",
      figures,
    );

    // Stream: send figures as initial NDJSON line, then stream text
    const encoder = new TextEncoder();

    const result = streamText({
      model,
      system: systemPrompt,
      prompt: "请对上述论文进行深入的结构化总结。",
      maxOutputTokens: 8192,
      abortSignal: req.signal,
    });

    const stream = new ReadableStream({
      async start(controller) {
        // Send figures metadata as first line (with dataUrl for client rendering)
        controller.enqueue(
          encoder.encode(
            JSON.stringify({ type: "figures", figures }) + "\n",
          ),
        );

        try {
          const textStream = result.textStream;
          for await (const chunk of textStream) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "text", text: chunk }) + "\n",
              ),
            );
          }
          controller.close();
        } catch (error) {
          if (req.signal.aborted) {
            controller.close();
            return;
          }
          console.error("Quick summary stream error:", error);
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
    console.error("Quick summary error:", error);
    return new Response(
      error instanceof Error ? error.message : "Quick summary failed",
      { status: 500 },
    );
  }
}

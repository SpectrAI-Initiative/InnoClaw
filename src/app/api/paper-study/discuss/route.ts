import { NextRequest } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { DISCUSSION_PHASES } from "@/lib/paper-discussion/roles";
import { buildDiscussionPhasePrompt } from "@/lib/paper-discussion/prompts";
import type { DiscussionMessage } from "@/lib/paper-discussion/types";

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
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 },
      );
    }

    const model = await getConfiguredModel();

    const articleContext = {
      title: article.title,
      authors: Array.isArray(article.authors) ? article.authors : [],
      publishedDate: article.publishedDate || "",
      source: article.source || "",
      abstract: article.abstract || "",
    };

    // Token limits per phase — quick mode is shorter
    const maxTokens = mode === "quick" ? 800 : 2000;

    // Stream each phase as a JSON line so the client can update incrementally
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let transcript = "";

        for (const phase of DISCUSSION_PHASES) {
          // Check if the client has disconnected
          if (req.signal.aborted) {
            controller.close();
            return;
          }

          const systemPrompt = buildDiscussionPhasePrompt(
            phase.id,
            articleContext,
            transcript,
            mode,
            locale,
          );

          try {
            const result = await generateText({
              model,
              system: systemPrompt,
              prompt: `Begin your analysis of the paper "${articleContext.title}".`,
              maxTokens,
              abortSignal: req.signal,
            });

            const content = result.text;

            const message: DiscussionMessage = {
              phaseId: phase.id,
              roleId: phase.roleId,
              content,
            };

            // Accumulate transcript for subsequent phases
            transcript += `\n\n### [${phase.roleId.toUpperCase()} — Phase ${phase.id}]\n${content}`;

            // Write JSON line
            controller.enqueue(encoder.encode(JSON.stringify(message) + "\n"));
          } catch (error) {
            if (req.signal.aborted) {
              controller.close();
              return;
            }
            console.error(`Discussion phase ${phase.id} error:`, error);
            controller.error(error);
            return;
          }
        }

        controller.close();
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

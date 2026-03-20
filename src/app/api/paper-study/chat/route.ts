import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { getConfiguredModel, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { providerSupportsTools } from "@/lib/ai/models";
import { buildPaperChatPrompt, buildPaperChatWithNotesPrompt } from "@/lib/ai/prompts";
import { createPaperChatTools } from "@/lib/ai/tools/paper-chat-tools";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, article, relatedNotes, llmProvider, llmModel } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 }
      );
    }

    const { model } = llmProvider && llmModel
      ? getModelFromOverride(llmProvider, llmModel)
      : { model: await getConfiguredModel() };
    const articleData = {
      title: article.title,
      authors: Array.isArray(article.authors) ? article.authors : [],
      publishedDate: article.publishedDate || "",
      source: article.source || "",
      abstract: article.abstract || "",
    };

    // Use enhanced prompt if related notes are available
    const systemPrompt =
      relatedNotes && Array.isArray(relatedNotes) && relatedNotes.length > 0
        ? buildPaperChatWithNotesPrompt(articleData, relatedNotes)
        : buildPaperChatPrompt(articleData);

    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );

    // Create paper tools for fetching full text and figures
    const paperTools = createPaperChatTools({
      id: article.id || "",
      url: article.url || "",
      pdfUrl: article.pdfUrl,
      source: article.source || "",
    });

    const useTools = providerSupportsTools(llmProvider || "openai");

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      ...(useTools ? { tools: paperTools, maxSteps: 5 } : {}),
      abortSignal: req.signal,
      onError({ error }) {
        console.error("Paper chat stream error:", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Paper chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Chat failed",
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { getConfiguredModelWithProvider, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { modelSupportsVision } from "@/lib/ai/models";
import { runtimeProviderSupportsTools } from "@/lib/ai/runtime-capabilities";
import { buildPaperChatPrompt, buildPaperChatWithNotesPrompt } from "@/lib/ai/prompts";
import { createPaperChatTools } from "@/lib/ai/tools/paper-chat-tools";
import { buildPaperChatContextMessage, buildPaperModelContext } from "../paper-model-context";
import { requireLocalReferenceAccess } from "@/lib/auth/local-reference";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, article, relatedNotes, llmProvider, llmModel } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    const referenceAccess = await requireLocalReferenceAccess(
      req,
      typeof article.url === "string" ? article.url : "",
    );
    if (referenceAccess instanceof NextResponse) {
      return referenceAccess;
    }
    const authorizedArticle = {
      ...article,
      url: referenceAccess.canonicalReference,
    };

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 }
      );
    }

    let providerId: string;
    let modelId: string | undefined;
    let model;
    if (llmProvider && llmModel) {
      const override = getModelFromOverride(llmProvider, llmModel);
      model = override.model;
      providerId = llmProvider;
      modelId = llmModel;
    } else {
      const configured = await getConfiguredModelWithProvider();
      model = configured.model;
      providerId = configured.providerId;
      modelId = configured.modelId;
    }

    const supportsVision = modelSupportsVision(providerId, modelId);
    const articleData = {
      title: authorizedArticle.title,
      authors: Array.isArray(authorizedArticle.authors) ? authorizedArticle.authors : [],
      publishedDate: authorizedArticle.publishedDate || "",
      source: authorizedArticle.source || "",
      abstract: authorizedArticle.abstract || "",
    };

    // Use enhanced prompt if related notes are available
    const systemPrompt =
      relatedNotes && Array.isArray(relatedNotes) && relatedNotes.length > 0
        ? buildPaperChatWithNotesPrompt(articleData, relatedNotes)
        : buildPaperChatPrompt(articleData);

    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );

    const paperContext = await buildPaperModelContext(authorizedArticle, supportsVision);
    const paperContextMessage = buildPaperChatContextMessage(
      { title: authorizedArticle.title },
      paperContext,
      supportsVision,
    );

    const groundedMessages = paperContextMessage
      ? [paperContextMessage, ...modelMessages]
      : modelMessages;

    // Create paper tools for fetching full text and figures
    const paperTools = createPaperChatTools({
      id: authorizedArticle.id || "",
      url: authorizedArticle.url || "",
      pdfUrl: authorizedArticle.pdfUrl,
      source: authorizedArticle.source || "",
    });

    const useTools = runtimeProviderSupportsTools(providerId);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: groundedMessages,
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

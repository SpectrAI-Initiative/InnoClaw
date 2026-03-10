import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildNoteChatPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, noteTitle, noteContent } = await req.json();

    if (!noteTitle || !noteContent) {
      return new Response("Missing note data", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 }
      );
    }

    const model = await getConfiguredModel();
    const systemPrompt = buildNoteChatPrompt(noteTitle, noteContent);

    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      abortSignal: req.signal,
      onError({ error }) {
        console.error("Note chat stream error:", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Note chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Chat failed",
      { status: 500 }
    );
  }
}

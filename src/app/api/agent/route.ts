import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage, stepCountIs } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { createAgentTools } from "@/lib/ai/agent-tools";
import { buildAgentSystemPrompt } from "@/lib/ai/prompts";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, workspaceId, cwd } = await req.json();

    if (!workspaceId || !cwd || typeof cwd !== "string") {
      return new Response("Missing workspaceId or cwd", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 }
      );
    }

    const model = await getConfiguredModel();
    const tools = createAgentTools(cwd);
    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );
    const systemPrompt = buildAgentSystemPrompt(cwd);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(10),
      onError({ error }) {
        console.error("Agent stream error:", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Agent error:", error);
    return new Response(
      error instanceof Error ? error.message : "Agent failed",
      { status: 500 }
    );
  }
}

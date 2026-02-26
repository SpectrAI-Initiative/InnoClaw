import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { retrieveRelevantChunks, retrieveByKeywordSearch } from "@/lib/rag/retriever";
import { buildChatSystemPrompt } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, workspaceId } = await req.json();

    if (!workspaceId) {
      return new Response("Missing workspaceId", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response("AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.", { status: 503 });
    }

    // Extract text from the latest user message
    const lastUserMessage = [...uiMessages]
      .reverse()
      .find((m: UIMessage) => m.role === "user");

    let userText = "";
    if (lastUserMessage) {
      // In AI SDK v6, messages use parts instead of content
      if (lastUserMessage.parts) {
        userText = lastUserMessage.parts
          .filter((p: { type: string }) => p.type === "text")
          .map((p: { text: string }) => p.text)
          .join("");
      } else if (lastUserMessage.content) {
        // Fallback for older format
        userText = lastUserMessage.content;
      }
    }

    // Retrieve relevant chunks (with keyword fallback if embedding fails or returns empty)
    let relevantChunks: Awaited<ReturnType<typeof retrieveRelevantChunks>> = [];
    if (userText) {
      try {
        relevantChunks = await retrieveRelevantChunks(userText, workspaceId);
      } catch (error) {
        console.warn("Embedding-based retrieval failed, falling back to keyword search:", error);
      }

      // Fallback to keyword search if embedding retrieval failed or returned nothing
      if (relevantChunks.length === 0) {
        try {
          relevantChunks = await retrieveByKeywordSearch(userText, workspaceId);
        } catch (fallbackError) {
          console.error("Keyword search also failed:", fallbackError);
        }
      }
    }

    // Build system prompt
    const systemPrompt = buildChatSystemPrompt(relevantChunks);

    // Get the configured model
    const model = await getConfiguredModel();

    // Save user message to DB
    if (userText) {
      await db.insert(chatMessages).values({
        id: nanoid(),
        workspaceId,
        role: "user",
        content: userText,
      });
    }

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(uiMessages);

    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      async onFinish({ text }) {
        // Save assistant message to DB
        const citations = relevantChunks.map((c) => ({
          sourceId: c.sourceId,
          chunkId: c.chunkId,
          fileName: c.fileName,
          excerpt: c.content.slice(0, 100),
        }));

        await db.insert(chatMessages).values({
          id: nanoid(),
          workspaceId,
          role: "assistant",
          content: text,
          citations: JSON.stringify(citations),
        });
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Chat failed",
      { status: 500 }
    );
  }
}

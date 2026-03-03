import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildMemorySummarizationPrompt } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import enMessages from "@/i18n/messages/en.json";
import zhMessages from "@/i18n/messages/zh.json";

/**
 * Convert UIMessage-like objects into a plain-text transcript for summarization.
 * Extracts text parts and tool call summaries.
 */
function messagesToTranscript(
  messages: Array<{
    role: string;
    parts?: Array<Record<string, unknown>>;
  }>
): string {
  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      const parts = msg.parts || [];

      const textParts = parts
        .filter((p) => p.type === "text")
        .map((p) => String(p.text || ""))
        .join("");

      const toolParts = parts
        .filter(
          (p) =>
            typeof p.type === "string" &&
            (p.type.startsWith("tool-") || p.type === "dynamic-tool")
        )
        .map((p) => {
          const toolName =
            typeof p.type === "string" && p.type.startsWith("tool-")
              ? p.type.slice(5)
              : "tool";
          const inputStr = p.input
            ? JSON.stringify(p.input).slice(0, 500)
            : "";
          const outputStr = p.output
            ? JSON.stringify(p.output).slice(0, 500)
            : "";
          return `[Tool: ${toolName}] Input: ${inputStr} | Output: ${outputStr}`;
        })
        .join("\n");

      return `### ${role}\n${textParts}${toolParts ? "\n" + toolParts : ""}`;
    })
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, messages, trigger, preview, locale } = await req.json();

    if (
      !workspaceId ||
      !messages ||
      !Array.isArray(messages) ||
      messages.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI not configured" },
        { status: 503 }
      );
    }

    const transcript = messagesToTranscript(messages);
    // Limit transcript to ~100K chars to leave room for the system prompt
    const truncatedTranscript = transcript.slice(0, 100_000);

    const model = await getConfiguredModel();
    const systemPrompt = buildMemorySummarizationPrompt(
      trigger === "clear" ? "clear" : "overflow"
    );

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: truncatedTranscript,
    });

    // Save as note
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const i18n = locale === "en" ? enMessages : zhMessages;
    const titleKey = trigger === "clear" ? "memoryTitleClear" : "memoryTitleOverflow";
    const title = i18n.notes[titleKey].replace("{date}", dateStr);

    // Preview mode: return summary without saving to DB
    if (preview) {
      return NextResponse.json({ title, content: text }, { status: 200 });
    }

    const id = nanoid();
    const isoNow = now.toISOString();

    await db.insert(notes).values({
      id,
      workspaceId,
      title,
      content: text,
      type: "memory",
      createdAt: isoNow,
      updatedAt: isoNow,
    });

    const note = await db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1);

    return NextResponse.json(note[0], { status: 201 });
  } catch (error) {
    console.error("Summarize error:", error);
    const message =
      error instanceof Error ? error.message : "Summarization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

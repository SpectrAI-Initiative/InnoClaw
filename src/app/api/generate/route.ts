import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildGeneratePrompt } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { sources, notes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, type } = await request.json();

    if (!workspaceId || !type) {
      return NextResponse.json(
        { error: "Missing workspaceId or type" },
        { status: 400 }
      );
    }

    if (!isAIAvailable()) {
      return NextResponse.json(
        { error: "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local." },
        { status: 503 }
      );
    }

    // Get all processed sources for this workspace
    const workspaceSources = await db
      .select({
        fileName: sources.fileName,
        rawContent: sources.rawContent,
      })
      .from(sources)
      .where(eq(sources.workspaceId, workspaceId));

    if (workspaceSources.length === 0) {
      return NextResponse.json(
        { error: "No sources found in workspace" },
        { status: 400 }
      );
    }

    const sourceContents = workspaceSources
      .filter((s) => s.rawContent && s.rawContent.length > 0)
      .map((s) => ({
        fileName: s.fileName,
        content: s.rawContent.slice(0, 10000), // Limit per source to fit context
      }));

    const systemPrompt = buildGeneratePrompt(type, sourceContents);
    const model = await getConfiguredModel();

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `Generate a ${type} based on the provided source materials.`,
    });

    // Create a note with the generated content
    const typeLabels: Record<string, string> = {
      summary: "Summary",
      faq: "FAQ",
      briefing: "Briefing Document",
      timeline: "Timeline",
    };

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(notes).values({
      id,
      workspaceId,
      title: `${typeLabels[type] || type} - ${new Date().toLocaleDateString()}`,
      content: text,
      type,
      createdAt: now,
      updatedAt: now,
    });

    const note = await db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .limit(1);

    return NextResponse.json(note[0], { status: 201 });
  } catch (error) {
    console.error("Generate error:", error);
    const message =
      error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

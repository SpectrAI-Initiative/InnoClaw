import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq, and, desc, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { streamText } from "ai";
import { getConfiguredModelWithProvider } from "@/lib/ai/provider";
import { formatDailyLogEntry, todayKey, buildDreamPrompt } from "@/lib/agent/kairos-memory";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException, requiredSearchParam } from "@/lib/api-errors";

/**
 * GET /api/agent/memory?workspaceId=xxx
 * Returns the memory index (all memory-type notes) for a workspace.
 */
export async function GET(req: NextRequest) {
  try {
    const workspaceId = requiredSearchParam(req, "workspaceId");
    if (workspaceId instanceof NextResponse) {
      return workspaceId;
    }
    const access = await requireWorkspaceAccess(req, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    const memoryNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.workspaceId, workspaceId), eq(notes.type, "memory")))
      .orderBy(desc(notes.createdAt));

    // Build a memory index summary
    const index = memoryNotes
      .map((n) => `- **${n.title}** (${n.createdAt}): ${n.content.slice(0, 100)}...`)
      .join("\n");

    return NextResponse.json({
      notes: memoryNotes,
      index: index || "No memories yet.",
      count: memoryNotes.length,
    });
  } catch (error) {
    return jsonException(error, "Failed to load memory");
  }
}

/**
 * POST /api/agent/memory
 * Actions: "remember" (append to daily log), "dream" (consolidate memories)
 */
export async function POST(req: NextRequest) {
  try {
    const { workspaceId, action, text } = await req.json();

    if (!workspaceId || !action) {
      return jsonError("Missing workspaceId or action", 400);
    }
    const access = await requireWorkspaceAccess(req, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    if (action === "remember") {
      if (!text) {
        return jsonError("Missing text for remember", 400);
      }

      const today = todayKey();
      const entry = formatDailyLogEntry(text);

      // Check if today's daily log already exists
      const existing = await db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.workspaceId, workspaceId),
            eq(notes.type, "memory"),
            like(notes.title, `Daily Log ${today}%`)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Append to existing daily log
        await db
          .update(notes)
          .set({
            content: existing[0].content + "\n" + entry,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(notes.id, existing[0].id));

        return NextResponse.json({ success: true, noteId: existing[0].id, appended: true });
      } else {
        // Create new daily log
        const noteId = nanoid();
        await db.insert(notes).values({
          id: noteId,
          workspaceId,
          title: `Daily Log ${today}`,
          content: entry,
          type: "memory",
        });

        return NextResponse.json({ success: true, noteId, appended: false });
      }
    }

    if (action === "dream") {
      // Load all memory notes for consolidation
      const memoryNotes = await db
        .select()
        .from(notes)
        .where(and(eq(notes.workspaceId, workspaceId), eq(notes.type, "memory")))
        .orderBy(desc(notes.createdAt));

      const dailyLogs = memoryNotes
        .filter((n) => n.title.startsWith("Daily Log"))
        .map((n) => `### ${n.title}\n${n.content}`);

      const existingMemories = memoryNotes
        .filter((n) => !n.title.startsWith("Daily Log"))
        .map((n) => `### ${n.title}\n${n.content}`);

      const dreamPrompt = buildDreamPrompt(workspaceId, dailyLogs, existingMemories);

      // Use LLM to consolidate
      const { model } = await getConfiguredModelWithProvider();

      const result = streamText({
        model,
        messages: [{ role: "user", content: dreamPrompt }],
        abortSignal: req.signal,
      });

      // Collect the full response
      let consolidated = "";
      for await (const chunk of result.textStream) {
        consolidated += chunk;
      }

      // Save consolidated memory
      const noteId = nanoid();
      const now = new Date().toISOString();
      await db.insert(notes).values({
        id: noteId,
        workspaceId,
        title: `Memory Consolidation ${now.slice(0, 10)}`,
        content: consolidated,
        type: "memory",
        createdAt: now,
        updatedAt: now,
      });

      return NextResponse.json({
        success: true,
        noteId,
        content: consolidated,
      });
    }

    return jsonError(`Unknown action: ${action}`, 400);
  } catch (error) {
    return jsonException(error, "Memory operation failed");
  }
}

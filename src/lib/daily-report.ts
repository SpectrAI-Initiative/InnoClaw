import { db } from "@/lib/db";
import { notes, workspaces } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildDailyReportPrompt } from "@/lib/ai/prompts";

/**
 * Get the YYYY-MM-DD date string for "today" (server local time).
 */
export function getTodayDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Check if a daily report already exists for the given workspace and date.
 */
async function dailyReportExists(
  workspaceId: string,
  dateStr: string
): Promise<boolean> {
  const existing = await db
    .select({ id: notes.id })
    .from(notes)
    .where(
      and(
        eq(notes.workspaceId, workspaceId),
        eq(notes.type, "daily_report"),
        like(notes.title, `%${dateStr}%`)
      )
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Get all memory notes for a workspace created on the given date.
 * Matches notes whose createdAt starts with the date string (ISO format).
 */
async function getMemoryNotesForDate(
  workspaceId: string,
  dateStr: string
) {
  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.workspaceId, workspaceId),
        eq(notes.type, "memory"),
        like(notes.createdAt, `${dateStr}%`)
      )
    )
    .orderBy(notes.createdAt);
}

export interface DailyReportResult {
  success: boolean;
  noteId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Generate a daily report for a single workspace.
 */
export async function generateDailyReport(
  workspaceId: string,
  dateStr?: string,
  locale: string = "en"
): Promise<DailyReportResult> {
  const date = dateStr || getTodayDateString();

  if (await dailyReportExists(workspaceId, date)) {
    return { success: true, skipped: true, reason: "exists" };
  }

  const memoryNotes = await getMemoryNotesForDate(workspaceId, date);
  if (memoryNotes.length === 0) {
    return { success: true, skipped: true, reason: "no_memories" };
  }

  if (!isAIAvailable()) {
    return { success: false, error: "AI not configured" };
  }

  const combined = memoryNotes
    .map((n, i) => `## Memory Note ${i + 1}: ${n.title}\n\n${n.content}`)
    .join("\n\n---\n\n");

  const truncated = combined.slice(0, 100_000);

  const model = await getConfiguredModel();
  const systemPrompt = buildDailyReportPrompt();

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: truncated,
  });

  const title =
    locale === "zh" ? `每日日报 - ${date}` : `Daily Report - ${date}`;

  const id = nanoid();
  const isoNow = new Date().toISOString();

  await db.insert(notes).values({
    id,
    workspaceId,
    title,
    content: text,
    type: "daily_report",
    createdAt: isoNow,
    updatedAt: isoNow,
  });

  return { success: true, noteId: id };
}

/**
 * Generate daily reports for ALL workspaces (used by the midnight scheduler).
 */
export async function generateAllDailyReports(
  dateStr?: string
): Promise<void> {
  const date = dateStr || getTodayDateString();
  const allWorkspaces = await db.select().from(workspaces);

  for (const ws of allWorkspaces) {
    try {
      const result = await generateDailyReport(ws.id, date);
      if (result.skipped) {
        console.log(
          `[daily-report] Skipped workspace ${ws.id}: ${result.reason}`
        );
      } else if (result.success) {
        console.log(`[daily-report] Generated report for workspace ${ws.id}`);
      } else {
        console.error(
          `[daily-report] Failed for workspace ${ws.id}: ${result.error}`
        );
      }
    } catch (err) {
      console.error(`[daily-report] Error for workspace ${ws.id}:`, err);
    }
  }
}

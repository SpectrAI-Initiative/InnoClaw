import { db } from "@/lib/db";
import { notes, workspaces } from "@/lib/db/schema";
import { eq, and, gte, lt, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildDailyReportPrompt } from "@/lib/ai/prompts";

/**
 * Get the YYYY-MM-DD date string for "today" based on the current ISO (UTC) date.
 * Uses the date portion of `toISOString()` so it matches ISO-formatted `createdAt` prefixes.
 */
export function getTodayDateString(now: Date = new Date()): string {
  // `toISOString()` is always in UTC and starts with "YYYY-MM-DD"
  return now.toISOString().slice(0, 10);
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
 * Get all memory notes for a workspace created on the given UTC date.
 * Uses a range query (>= dateStr, < nextDay) for reliable matching against
 * ISO-formatted createdAt timestamps.
 */
async function getMemoryNotesForDate(
  workspaceId: string,
  dateStr: string
) {
  // Compute the next day from the YYYY-MM-DD string for an exclusive upper bound
  const [year, month, day] = dateStr.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayStr = nextDay.toISOString().slice(0, 10);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.workspaceId, workspaceId),
        eq(notes.type, "memory"),
        gte(notes.createdAt, dateStr),
        lt(notes.createdAt, nextDayStr)
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

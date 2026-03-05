import { db } from "@/lib/db";
import { notes, workspaces } from "@/lib/db/schema";
import { eq, and, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildDailyReportPrompt } from "@/lib/ai/prompts";

/**
 * Get the YYYY-MM-DD date string for a given Date in UTC.
 * Using UTC matches the date prefix of timestamps stored via toISOString().
 */
export function getUTCDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get the YYYY-MM-DD date string for "today" in UTC.
 * This matches the date prefix of timestamps stored via toISOString().
 */
export function getTodayDateString(): string {
  return getUTCDateString(new Date());
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
        eq(notes.reportDate, dateStr)
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
  errorCode?: string;
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
    return { success: false, error: "AI not configured", errorCode: "ai_not_configured" };
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

  const inserted = await db
    .insert(notes)
    .values({
      id,
      workspaceId,
      title,
      content: text,
      type: "daily_report",
      reportDate: date,
      createdAt: isoNow,
      updatedAt: isoNow,
    })
    .onConflictDoNothing({
      target: [notes.workspaceId, notes.type, notes.reportDate],
    })
    .returning({ insertedId: notes.id });

  // If another concurrent request already inserted the report, treat as skipped
  if (inserted.length === 0) {
    return { success: true, skipped: true, reason: "exists" };
  }

  return { success: true, noteId: id };
}

/**
 * Generate daily reports for ALL workspaces (used by the midnight scheduler).
 * Processes workspaces in parallel with bounded concurrency to balance
 * throughput vs. rate limits.
 */
export async function generateAllDailyReports(
  dateStr?: string
): Promise<void> {
  const date = dateStr || getTodayDateString();
  const allWorkspaces = await db.select().from(workspaces);

  const CONCURRENCY = 5;
  for (let i = 0; i < allWorkspaces.length; i += CONCURRENCY) {
    const batch = allWorkspaces.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((ws) => generateDailyReport(ws.id, date))
    );
    results.forEach((outcome, idx) => {
      const ws = batch[idx];
      if (outcome.status === "rejected") {
        console.error(`[daily-report] Error for workspace ${ws.id}:`, outcome.reason);
      } else {
        const result = outcome.value;
        if (result.skipped) {
          console.log(`[daily-report] Skipped workspace ${ws.id}: ${result.reason}`);
        } else if (result.success) {
          console.log(`[daily-report] Generated report for workspace ${ws.id}`);
        } else {
          console.error(`[daily-report] Failed for workspace ${ws.id}: ${result.error}`);
        }
      }
    });
  }
}

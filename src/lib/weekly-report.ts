import { db } from "@/lib/db";
import { notes, workspaces } from "@/lib/db/schema";
import { eq, and, gte, lt, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { generateText } from "ai";
import { getConfiguredModel, isAIAvailable } from "@/lib/ai/provider";
import { buildWeeklyReportPrompt } from "@/lib/ai/prompts";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Format a Date as YYYY-MM-DD using UTC components.
 * This aligns with `createdAt = new Date().toISOString()` stored in UTC.
 */
function formatDateUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Calculate the week range: last Saturday to this Thursday.
 *
 * Given a reference date (defaults to today), computes:
 * - startDate: the most recent Saturday (going back from reference)
 * - endDate: the Thursday following that Saturday (5 days after Saturday)
 *
 * For a Friday reference: last Saturday = 6 days ago, Thursday = 1 day ago.
 */
export function getWeekRange(referenceDate?: Date): {
  startDate: string;
  endDate: string;
  weekLabel: string;
} {
  const ref = referenceDate || new Date();
  const dayOfWeek = ref.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Find the most recent Saturday (before or on ref) using UTC
  const daysSinceSat = (dayOfWeek - 6 + 7) % 7;
  const saturday = new Date(ref);
  saturday.setUTCDate(ref.getUTCDate() - daysSinceSat);
  saturday.setUTCHours(0, 0, 0, 0);

  // Thursday = Saturday + 5 days
  const thursday = new Date(saturday);
  thursday.setUTCDate(saturday.getUTCDate() + 5);

  const startDate = formatDateUTC(saturday);
  const endDate = formatDateUTC(thursday);

  // Week label: MM.DD-MM.DD (UTC)
  const weekLabel = `${pad(saturday.getUTCMonth() + 1)}.${pad(saturday.getUTCDate())}-${pad(thursday.getUTCMonth() + 1)}.${pad(thursday.getUTCDate())}`;

  return { startDate, endDate, weekLabel };
}

/**
 * Check if a weekly report already exists for the given workspace and week.
 */
async function weeklyReportExists(
  workspaceId: string,
  weekLabel: string
): Promise<boolean> {
  const existing = await db
    .select({ id: notes.id })
    .from(notes)
    .where(
      and(
        eq(notes.workspaceId, workspaceId),
        eq(notes.type, "weekly_report"),
        like(notes.title, `%${weekLabel}%`)
      )
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Get all memory notes for a workspace within a date range (inclusive).
 * startDate and endDate are YYYY-MM-DD strings.
 */
async function getMemoryNotesForRange(
  workspaceId: string,
  startDate: string,
  endDate: string
) {
  // endDate is inclusive, so we query < endDate+1day
  // Parse as explicit UTC to avoid timezone mismatch
  const [year, month, day] = endDate.split("-").map(Number);
  const endDateObj = new Date(Date.UTC(year, month - 1, day + 1));
  const endDateExclusive = formatDateUTC(endDateObj);

  return db
    .select()
    .from(notes)
    .where(
      and(
        eq(notes.workspaceId, workspaceId),
        eq(notes.type, "memory"),
        gte(notes.createdAt, startDate),
        lt(notes.createdAt, endDateExclusive)
      )
    )
    .orderBy(notes.createdAt);
}

export interface WeeklyReportResult {
  success: boolean;
  noteId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Generate a weekly report for a single workspace.
 */
export async function generateWeeklyReport(
  workspaceId: string,
  referenceDate?: Date,
  locale: string = "en"
): Promise<WeeklyReportResult> {
  const { startDate, endDate, weekLabel } = getWeekRange(referenceDate);

  if (await weeklyReportExists(workspaceId, weekLabel)) {
    return { success: true, skipped: true, reason: "exists" };
  }

  const memoryNotes = await getMemoryNotesForRange(
    workspaceId,
    startDate,
    endDate
  );
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
  const dateRange = `${startDate} ~ ${endDate}`;
  const systemPrompt = buildWeeklyReportPrompt(dateRange);

  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: truncated,
  });

  const title =
    locale === "zh"
      ? `每周周报 - ${weekLabel}`
      : `Weekly Report - ${weekLabel}`;

  const id = nanoid();
  const isoNow = new Date().toISOString();

  await db.insert(notes).values({
    id,
    workspaceId,
    title,
    content: text,
    type: "weekly_report",
    createdAt: isoNow,
    updatedAt: isoNow,
  });

  return { success: true, noteId: id };
}

/**
 * Generate weekly reports for ALL workspaces (used by the Friday scheduler).
 */
export async function generateAllWeeklyReports(
  referenceDate?: Date
): Promise<void> {
  const allWorkspaces = await db.select().from(workspaces);

  for (const ws of allWorkspaces) {
    try {
      const result = await generateWeeklyReport(ws.id, referenceDate);
      if (result.skipped) {
        console.log(
          `[weekly-report] Skipped workspace ${ws.id}: ${result.reason}`
        );
      } else if (result.success) {
        console.log(
          `[weekly-report] Generated report for workspace ${ws.id}`
        );
      } else {
        console.error(
          `[weekly-report] Failed for workspace ${ws.id}: ${result.error}`
        );
      }
    } catch (err) {
      console.error(`[weekly-report] Error for workspace ${ws.id}:`, err);
    }
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  generateDailyReport,
  getTodayDateString,
} from "@/lib/daily-report";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, date, locale } = await req.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing workspaceId" },
        { status: 400 }
      );
    }

    const dateStr = date || getTodayDateString();
    const result = await generateDailyReport(
      workspaceId,
      dateStr,
      locale || "en"
    );

    if (!result.success) {
      const status = result.errorCode === "ai_not_configured" ? 503 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    if (result.skipped) {
      return NextResponse.json(
        { skipped: true, reason: result.reason },
        { status: 200 }
      );
    }

    const note = await db
      .select()
      .from(notes)
      .where(eq(notes.id, result.noteId!))
      .limit(1);

    return NextResponse.json(note[0], { status: 201 });
  } catch (error) {
    console.error("Daily report error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Daily report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

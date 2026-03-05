import { NextRequest, NextResponse } from "next/server";
import { generateWeeklyReport } from "@/lib/weekly-report";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, locale } = await req.json();

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing workspaceId" },
        { status: 400 }
      );
    }

    const result = await generateWeeklyReport(
      workspaceId,
      undefined,
      locale || "en"
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
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
    console.error("Weekly report error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Weekly report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

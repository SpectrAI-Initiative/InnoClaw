import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { error: "Missing workspaceId" },
        { status: 400 }
      );
    }

    const allNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.workspaceId, workspaceId))
      .orderBy(desc(notes.createdAt));

    return NextResponse.json(allNotes);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list notes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, title, content, type } = body;

    if (!workspaceId || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(notes).values({
      id,
      workspaceId,
      title,
      content: content || "",
      type: type || "manual",
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
    const message =
      error instanceof Error ? error.message : "Failed to create note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireNoteAccess } from "@/lib/auth/ownership";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const access = await requireNoteAccess(request, noteId);
    if (access instanceof NextResponse) {
      return access;
    }

    const note = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    if (note.length === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json(note[0]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const access = await requireNoteAccess(request, noteId);
    if (access instanceof NextResponse) {
      return access;
    }
    const body = await request.json();

    await db
      .update(notes)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(notes.id, noteId));

    const updated = await db
      .select()
      .from(notes)
      .where(eq(notes.id, noteId))
      .limit(1);

    return NextResponse.json(updated[0]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    const access = await requireNoteAccess(request, noteId);
    if (access instanceof NextResponse) {
      return access;
    }

    await db.delete(notes).where(eq(notes.id, noteId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

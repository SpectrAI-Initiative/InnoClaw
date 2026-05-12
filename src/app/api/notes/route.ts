import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException, requiredSearchParam } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  try {
    const workspaceId = requiredSearchParam(request, "workspaceId");
    if (workspaceId instanceof NextResponse) {
      return workspaceId;
    }

    const access = await requireWorkspaceAccess(request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    const allNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.workspaceId, workspaceId))
      .orderBy(desc(notes.createdAt));

    return NextResponse.json(allNotes);
  } catch (error) {
    return jsonException(error, "Failed to list notes");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, title, content, type } = body;

    if (!workspaceId || !title) {
      return jsonError("Missing required fields", 400);
    }

    const access = await requireWorkspaceAccess(request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
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
    return jsonException(error, "Failed to create note");
  }
}

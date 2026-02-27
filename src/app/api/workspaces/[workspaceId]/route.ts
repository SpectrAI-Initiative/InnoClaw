import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, sources, notes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;

    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    if (workspace.length === 0) {
      return NextResponse.json(
        { error: "Workspace not found" },
        { status: 404 }
      );
    }

    // Get counts
    const [sourceCount] = await db
      .select({ count: count() })
      .from(sources)
      .where(eq(sources.workspaceId, workspaceId));

    const [noteCount] = await db
      .select({ count: count() })
      .from(notes)
      .where(eq(notes.workspaceId, workspaceId));

    // Update lastOpenedAt
    await db
      .update(workspaces)
      .set({ lastOpenedAt: new Date().toISOString() })
      .where(eq(workspaces.id, workspaceId));

    return NextResponse.json({
      ...workspace[0],
      sourceCount: sourceCount.count,
      noteCount: noteCount.count,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();

    await db
      .update(workspaces)
      .set({
        ...body,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(workspaces.id, workspaceId));

    const updated = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    return NextResponse.json(updated[0]);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

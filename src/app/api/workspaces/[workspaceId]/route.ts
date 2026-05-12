import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, sources, notes } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonException } from "@/lib/api-errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;

    const access = await requireWorkspaceAccess(request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }
    const workspace = access.workspace;

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
      ...workspace,
      sourceCount: sourceCount.count,
      noteCount: noteCount.count,
    });
  } catch (error) {
    return jsonException(error, "Failed to get workspace");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const access = await requireWorkspaceAccess(request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }
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
    return jsonException(error, "Failed to update workspace");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const access = await requireWorkspaceAccess(request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to delete workspace");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datasetWorkspaceLinks, workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId]/workspaces - List workspaces linked to this dataset
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;

    const links = await db
      .select({
        linkId: datasetWorkspaceLinks.id,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        folderPath: workspaces.folderPath,
        linkedAt: datasetWorkspaceLinks.createdAt,
      })
      .from(datasetWorkspaceLinks)
      .innerJoin(workspaces, eq(datasetWorkspaceLinks.workspaceId, workspaces.id))
      .where(eq(datasetWorkspaceLinks.datasetId, datasetId));

    return NextResponse.json(links);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list linked workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/datasets/[datasetId]/workspaces - Link a workspace to this dataset
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const body = await request.json();
    const { workspaceId } = body as { workspaceId: string };

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(datasetWorkspaceLinks)
      .where(
        and(
          eq(datasetWorkspaceLinks.datasetId, datasetId),
          eq(datasetWorkspaceLinks.workspaceId, workspaceId),
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Already linked" }, { status: 409 });
    }

    const id = nanoid();
    await db.insert(datasetWorkspaceLinks).values({
      id,
      datasetId,
      workspaceId,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ id, datasetId, workspaceId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to link workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/datasets/[datasetId]/workspaces - Unlink a workspace from this dataset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(datasetWorkspaceLinks)
      .where(
        and(
          eq(datasetWorkspaceLinks.datasetId, datasetId),
          eq(datasetWorkspaceLinks.workspaceId, workspaceId),
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await db
      .delete(datasetWorkspaceLinks)
      .where(eq(datasetWorkspaceLinks.id, existing[0].id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unlink workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

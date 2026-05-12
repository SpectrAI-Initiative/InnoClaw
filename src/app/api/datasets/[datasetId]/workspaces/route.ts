import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datasetWorkspaceLinks, workspaces } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireDatasetAccess, requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException, requiredSearchParam } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId]/workspaces - List workspaces linked to this dataset
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const datasetAccess = await requireDatasetAccess(_request, datasetId);
    if (datasetAccess instanceof NextResponse) {
      return datasetAccess;
    }

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
    return jsonException(error, "Failed to list linked workspaces");
  }
}

/**
 * POST /api/datasets/[datasetId]/workspaces - Link a workspace to this dataset
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const datasetAccess = await requireDatasetAccess(request, datasetId);
    if (datasetAccess instanceof NextResponse) {
      return datasetAccess;
    }
    const body = await request.json();
    const { workspaceId } = body as { workspaceId: string };

    if (!workspaceId) {
      return jsonError("Missing workspaceId", 400);
    }
    const workspaceAccess = await requireWorkspaceAccess(request, workspaceId);
    if (workspaceAccess instanceof NextResponse) {
      return workspaceAccess;
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
      return jsonError("Already linked", 409);
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
    return jsonException(error, "Failed to link workspace");
  }
}

/**
 * DELETE /api/datasets/[datasetId]/workspaces - Unlink a workspace from this dataset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const datasetAccess = await requireDatasetAccess(request, datasetId);
    if (datasetAccess instanceof NextResponse) {
      return datasetAccess;
    }
    const workspaceId = requiredSearchParam(request, "workspaceId");
    if (workspaceId instanceof NextResponse) {
      return workspaceId;
    }
    const workspaceAccess = await requireWorkspaceAccess(request, workspaceId);
    if (workspaceAccess instanceof NextResponse) {
      return workspaceAccess;
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
      return jsonError("Link not found", 404);
    }

    await db
      .delete(datasetWorkspaceLinks)
      .where(eq(datasetWorkspaceLinks.id, existing[0].id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to unlink workspace");
  }
}

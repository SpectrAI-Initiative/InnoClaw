import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datasetWorkspaceLinks, hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireWorkspaceAccess } from "@/lib/auth/ownership";
import { jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ workspaceId: string }> };

/**
 * GET /api/workspaces/[workspaceId]/datasets - List datasets linked to this workspace
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
    const access = await requireWorkspaceAccess(_request, workspaceId);
    if (access instanceof NextResponse) {
      return access;
    }

    const rows = await db
      .select({
        dataset: hfDatasets,
        linkedAt: datasetWorkspaceLinks.createdAt,
      })
      .from(datasetWorkspaceLinks)
      .innerJoin(hfDatasets, eq(datasetWorkspaceLinks.datasetId, hfDatasets.id))
      .where(eq(datasetWorkspaceLinks.workspaceId, workspaceId));

    const result = rows.map((r) => ({
      ...r.dataset,
      sourceConfig: r.dataset.sourceConfig ? JSON.parse(r.dataset.sourceConfig) : null,
      manifest: r.dataset.manifest ? JSON.parse(r.dataset.manifest) : null,
      stats: r.dataset.stats ? JSON.parse(r.dataset.stats) : null,
      linkedAt: r.linkedAt,
    }));

    return NextResponse.json(result);
  } catch (error) {
    return jsonException(error, "Failed to list workspace datasets");
  }
}

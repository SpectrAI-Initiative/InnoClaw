import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import { removeProgress } from "@/lib/hf-datasets/progress";
import { requireDatasetAccess } from "@/lib/auth/ownership";
import { jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId] - Get dataset details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }
    const row = access.dataset;
    return NextResponse.json({
      ...row,
      sourceConfig: row.sourceConfig ? JSON.parse(row.sourceConfig) : null,
      manifest: row.manifest ? JSON.parse(row.manifest) : null,
      stats: row.stats ? JSON.parse(row.stats) : null,
    });
  } catch (error) {
    return jsonException(error, "Failed to get dataset");
  }
}

/**
 * DELETE /api/datasets/[datasetId] - Delete a dataset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }

    const { searchParams } = new URL(request.url);
    const deleteFiles = searchParams.get("deleteFiles") === "true";

    const { dataset } = access;

    // Delete files if requested
    if (deleteFiles && dataset.localPath) {
      try {
        fs.rmSync(dataset.localPath, { recursive: true, force: true });
      } catch {
        // Ignore file deletion errors
      }
    }

    // Remove progress tracker
    removeProgress(datasetId);

    // Delete from database
    await db.delete(hfDatasets).where(eq(hfDatasets.id, datasetId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to delete dataset");
  }
}

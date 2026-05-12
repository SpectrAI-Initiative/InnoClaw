import { NextRequest, NextResponse } from "next/server";
import { getProgress } from "@/lib/hf-datasets/progress";
import { requireDatasetAccess } from "@/lib/auth/ownership";
import { jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId]/status - Get live download progress
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }

    // Check in-memory progress first (for active downloads)
    const liveProgress = getProgress(datasetId);
    if (liveProgress) {
      return NextResponse.json(liveProgress);
    }

    // Fall back to database status from the access-checked row.
    const row = access.dataset;
    return NextResponse.json({
      datasetId,
      status: row.status,
      progress: row.progress,
      phase: row.status === "ready" ? "done" : row.status,
      downloadedBytes: row.sizeBytes ?? 0,
      totalBytes: row.sizeBytes ?? 0,
      downloadedFiles: row.numFiles ?? 0,
      totalFiles: row.numFiles ?? 0,
    });
  } catch (error) {
    return jsonException(error, "Failed to get status");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getProgress } from "@/lib/hf-datasets/progress";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId]/status - Get live download progress
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;

    // Check in-memory progress first (for active downloads)
    const liveProgress = getProgress(datasetId);
    if (liveProgress) {
      return NextResponse.json(liveProgress);
    }

    // Fall back to database status
    const rows = await db
      .select({
        status: hfDatasets.status,
        progress: hfDatasets.progress,
        lastError: hfDatasets.lastError,
        sizeBytes: hfDatasets.sizeBytes,
        numFiles: hfDatasets.numFiles,
      })
      .from(hfDatasets)
      .where(eq(hfDatasets.id, datasetId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const row = rows[0];
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
    const message = error instanceof Error ? error.message : "Failed to get status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

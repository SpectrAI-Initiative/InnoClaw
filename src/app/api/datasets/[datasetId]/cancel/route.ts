import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cancelDownload, removeProgress } from "@/lib/hf-datasets/progress";
import { requireDatasetAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * POST /api/datasets/[datasetId]/cancel - Cancel an in-progress or paused download
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }

    const status = access.dataset.status;
    if (status !== "downloading" && status !== "pending" && status !== "paused") {
      return jsonError("Dataset is not in a cancellable state", 400);
    }

    // Try to abort if actively downloading
    cancelDownload(datasetId);
    // Clean up any in-memory progress (e.g. paused state)
    removeProgress(datasetId);

    await db
      .update(hfDatasets)
      .set({
        status: "cancelled",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hfDatasets.id, datasetId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonException(error, "Failed to cancel download");
  }
}

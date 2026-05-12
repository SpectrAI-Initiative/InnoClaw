import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pauseDownload } from "@/lib/hf-datasets/progress";
import { requireDatasetAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * POST /api/datasets/[datasetId]/pause - Pause an in-progress download
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }

    const status = access.dataset.status;
    if (status !== "downloading" && status !== "pending") {
      return jsonError("Dataset is not currently downloading", 400);
    }

    const paused = pauseDownload(datasetId);

    // Always update DB even if in-memory abort didn't fire (e.g. pending state)
    await db
      .update(hfDatasets)
      .set({
        status: "paused",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hfDatasets.id, datasetId));

    return NextResponse.json({ success: true, paused });
  } catch (error) {
    return jsonException(error, "Failed to pause download");
  }
}

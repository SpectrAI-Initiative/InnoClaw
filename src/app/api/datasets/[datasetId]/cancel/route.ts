import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cancelDownload, removeProgress } from "@/lib/hf-datasets/progress";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * POST /api/datasets/[datasetId]/cancel - Cancel an in-progress or paused download
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;

    const rows = await db
      .select()
      .from(hfDatasets)
      .where(eq(hfDatasets.id, datasetId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const status = rows[0].status;
    if (status !== "downloading" && status !== "pending" && status !== "paused") {
      return NextResponse.json(
        { error: "Dataset is not in a cancellable state" },
        { status: 400 }
      );
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
    const message = error instanceof Error ? error.message : "Failed to cancel download";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

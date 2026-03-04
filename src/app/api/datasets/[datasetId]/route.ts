import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import { removeProgress } from "@/lib/hf-datasets/progress";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * GET /api/datasets/[datasetId] - Get dataset details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
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

    const row = rows[0];
    return NextResponse.json({
      ...row,
      sourceConfig: row.sourceConfig ? JSON.parse(row.sourceConfig) : null,
      manifest: row.manifest ? JSON.parse(row.manifest) : null,
      stats: row.stats ? JSON.parse(row.stats) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get dataset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/datasets/[datasetId] - Delete a dataset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const { searchParams } = new URL(request.url);
    const deleteFiles = searchParams.get("deleteFiles") === "true";

    const rows = await db
      .select()
      .from(hfDatasets)
      .where(eq(hfDatasets.id, datasetId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const dataset = rows[0];

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
    const message = error instanceof Error ? error.message : "Failed to delete dataset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

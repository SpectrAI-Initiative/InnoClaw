import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildManifest, computeStats } from "@/lib/hf-datasets/manifest";
import * as fs from "fs";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * POST /api/datasets/[datasetId]/refresh - Recalculate manifest & stats from disk
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

    const dataset = rows[0];

    if (!dataset.localPath || !fs.existsSync(dataset.localPath)) {
      return NextResponse.json(
        { error: "Dataset files not found on disk" },
        { status: 400 }
      );
    }

    const manifest = buildManifest(dataset.localPath);
    const stats = computeStats(dataset.localPath, manifest);

    const totalFiles = Object.values(manifest.splits).reduce(
      (sum, s) => sum + s.numFiles,
      0
    );

    const now = new Date().toISOString();
    await db
      .update(hfDatasets)
      .set({
        manifest: JSON.stringify(manifest),
        stats: JSON.stringify(stats),
        sizeBytes: stats.sizeBytes,
        numFiles: totalFiles,
        updatedAt: now,
      })
      .where(eq(hfDatasets.id, datasetId));

    return NextResponse.json({
      success: true,
      sizeBytes: stats.sizeBytes,
      numFiles: totalFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildManifest, computeStats } from "@/lib/hf-datasets/manifest";
import * as fs from "fs";
import { requireDatasetAccess } from "@/lib/auth/ownership";
import { jsonError, jsonException } from "@/lib/api-errors";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * POST /api/datasets/[datasetId]/refresh - Recalculate manifest & stats from disk
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { datasetId } = await params;
    const access = await requireDatasetAccess(request, datasetId);
    if (access instanceof NextResponse) {
      return access;
    }

    const dataset = access.dataset;

    if (!dataset.localPath || !fs.existsSync(dataset.localPath)) {
      return jsonError("Dataset files not found on disk", 400);
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
    return jsonException(error, "Failed to refresh stats");
  }
}

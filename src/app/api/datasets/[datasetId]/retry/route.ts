import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { downloadRepo } from "@/lib/hf-datasets/downloader";
import { buildManifest, computeStats } from "@/lib/hf-datasets/manifest";
import { setProgress, markFinished } from "@/lib/hf-datasets/progress";
import type { HfRepoType, HfDatasetSourceConfig } from "@/types";

type RouteParams = { params: Promise<{ datasetId: string }> };

/**
 * POST /api/datasets/[datasetId]/retry - Retry a failed download
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
    if (dataset.status === "downloading") {
      return NextResponse.json(
        { error: "Dataset is already downloading" },
        { status: 400 }
      );
    }

    // Reset status
    await db
      .update(hfDatasets)
      .set({
        status: "pending",
        progress: 0,
        lastError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hfDatasets.id, datasetId));

    // Restart download
    const sourceConfig: HfDatasetSourceConfig | null = dataset.sourceConfig
      ? JSON.parse(dataset.sourceConfig)
      : null;

    startRetryDownload(datasetId, {
      repoId: dataset.repoId,
      repoType: dataset.repoType as HfRepoType,
      revision: dataset.revision || undefined,
      allowPatterns: sourceConfig?.allowPatterns,
      ignorePatterns: sourceConfig?.ignorePatterns,
    }, dataset.localPath!);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retry download";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function startRetryDownload(
  datasetId: string,
  config: {
    repoId: string;
    repoType: HfRepoType;
    revision?: string;
    allowPatterns?: string[];
    ignorePatterns?: string[];
  },
  localPath: string
) {
  try {
    await db
      .update(hfDatasets)
      .set({ status: "downloading", updatedAt: new Date().toISOString() })
      .where(eq(hfDatasets.id, datasetId));

    setProgress(datasetId, {
      status: "downloading",
      phase: "downloading",
      progress: 0,
    });

    const { sizeBytes, numFiles } = await downloadRepo(datasetId, config, localPath);

    setProgress(datasetId, { phase: "building_manifest", progress: 90 });
    const manifest = buildManifest(localPath);

    setProgress(datasetId, { phase: "computing_stats", progress: 95 });
    const stats = computeStats(localPath, manifest);

    const now = new Date().toISOString();
    await db
      .update(hfDatasets)
      .set({
        status: "ready",
        progress: 100,
        sizeBytes: stats.sizeBytes,
        numFiles,
        manifest: JSON.stringify(manifest),
        stats: JSON.stringify(stats),
        lastSyncAt: now,
        updatedAt: now,
        lastError: null,
      })
      .where(eq(hfDatasets.id, datasetId));

    markFinished(datasetId, "ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    await db
      .update(hfDatasets)
      .set({
        status: error instanceof Error && error.message === "Download cancelled" ? "cancelled" : "failed",
        lastError: message,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(hfDatasets.id, datasetId));

    markFinished(
      datasetId,
      error instanceof Error && error.message === "Download cancelled" ? "cancelled" : "failed"
    );
  }
}

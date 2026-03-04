import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import * as path from "path";
import * as fs from "fs";
import { downloadRepo } from "@/lib/hf-datasets/downloader";
import { buildManifest, computeStats } from "@/lib/hf-datasets/manifest";
import { setProgress, markFinished } from "@/lib/hf-datasets/progress";
import type { HfRepoType } from "@/types";

function getDatasetStorageRoot(): string {
  return process.env.HF_DATASETS_PATH || path.join(process.cwd(), "data", "hf-datasets");
}

/**
 * GET /api/datasets - List all datasets
 */
export async function GET() {
  try {
    const rows = await db
      .select()
      .from(hfDatasets)
      .orderBy(desc(hfDatasets.createdAt));

    const result = rows.map(parseDatasetRow);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list datasets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/datasets - Create and start downloading a dataset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      repoId,
      repoType = "dataset",
      revision,
      name,
      allowPatterns,
      ignorePatterns,
    } = body as {
      repoId: string;
      repoType?: HfRepoType;
      revision?: string;
      name?: string;
      allowPatterns?: string[];
      ignorePatterns?: string[];
    };

    if (!repoId) {
      return NextResponse.json({ error: "Missing repoId" }, { status: 400 });
    }

    // Derive display name from repoId
    const displayName = name || repoId.split("/").pop() || repoId;

    // Build local path
    const storageRoot = getDatasetStorageRoot();
    const sanitizedId = repoId.replace(/\//g, "_");
    const localPath = path.join(storageRoot, sanitizedId).replace(/\\/g, "/");

    const sourceConfig = (allowPatterns || ignorePatterns)
      ? JSON.stringify({ allowPatterns, ignorePatterns })
      : null;

    const id = nanoid();
    const now = new Date().toISOString();

    await db.insert(hfDatasets).values({
      id,
      name: displayName,
      repoId,
      repoType,
      revision: revision || null,
      sourceConfig,
      status: "pending",
      progress: 0,
      localPath,
      createdAt: now,
      updatedAt: now,
    });

    // Start download in background (fire-and-forget)
    startDownload(id, {
      repoId,
      repoType,
      revision,
      allowPatterns,
      ignorePatterns,
    }, localPath);

    const dataset = await db
      .select()
      .from(hfDatasets)
      .where(eq(hfDatasets.id, id))
      .limit(1);

    return NextResponse.json(parseDatasetRow(dataset[0]), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create dataset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function startDownload(
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
    // Update status to downloading
    await db
      .update(hfDatasets)
      .set({ status: "downloading", updatedAt: new Date().toISOString() })
      .where(eq(hfDatasets.id, datasetId));

    setProgress(datasetId, {
      status: "downloading",
      phase: "downloading",
      progress: 0,
    });

    // Download files
    const { sizeBytes, numFiles } = await downloadRepo(datasetId, config, localPath);

    // Build manifest
    setProgress(datasetId, { phase: "building_manifest", progress: 90 });
    const manifest = buildManifest(localPath);

    // Compute stats
    setProgress(datasetId, { phase: "computing_stats", progress: 95 });
    const stats = computeStats(localPath, manifest);

    // Update database
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
    const now = new Date().toISOString();
    await db
      .update(hfDatasets)
      .set({
        status: error instanceof Error && error.message === "Download cancelled" ? "cancelled" : "failed",
        lastError: message,
        updatedAt: now,
      })
      .where(eq(hfDatasets.id, datasetId));

    markFinished(
      datasetId,
      error instanceof Error && error.message === "Download cancelled" ? "cancelled" : "failed"
    );
  }
}

function parseDatasetRow(row: typeof hfDatasets.$inferSelect) {
  return {
    ...row,
    sourceConfig: row.sourceConfig ? JSON.parse(row.sourceConfig) : null,
    manifest: row.manifest ? JSON.parse(row.manifest) : null,
    stats: row.stats ? JSON.parse(row.stats) : null,
  };
}

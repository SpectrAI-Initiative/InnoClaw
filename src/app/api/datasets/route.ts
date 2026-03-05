import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import * as path from "path";
import { downloadRepo } from "@/lib/hf-datasets/downloader";
import { downloadModelScopeRepo } from "@/lib/modelscope/downloader";
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
      source = "huggingface",
    } = body as {
      repoId: string;
      repoType?: HfRepoType;
      revision?: string;
      name?: string;
      allowPatterns?: string[];
      ignorePatterns?: string[];
      source?: string;
    };

    if (!repoId) {
      return NextResponse.json({ error: "Missing repoId" }, { status: 400 });
    }

    const validSources = new Set(["huggingface", "modelscope"]);
    if (!validSources.has(source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
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
      source,
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
      source,
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
    source?: string;
  },
  localPath: string
) {
  try {
    // Update status to downloading
    await db
      .update(hfDatasets)
      .set({ status: "downloading", progress: 0, updatedAt: new Date().toISOString() })
      .where(eq(hfDatasets.id, datasetId));

    setProgress(datasetId, {
      status: "downloading",
      phase: "downloading",
      progress: 0,
    });

    // Download files using the appropriate downloader
    let result: { sizeBytes: number; numFiles: number };

    if (config.source === "modelscope") {
      result = await downloadModelScopeRepo(datasetId, config, localPath);
    } else {
      result = await downloadRepo(datasetId, config, localPath);
    }

    const { numFiles } = result;

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
    const isPauseError = error instanceof Error && error.message === "Download paused";
    const isCancelError = error instanceof Error && error.message === "Download cancelled";

    if (isPauseError) {
      // Paused — status already set by pauseDownload(), just update DB
      await db
        .update(hfDatasets)
        .set({
          status: "paused",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(hfDatasets.id, datasetId));
      markFinished(datasetId, "paused");
      return;
    }

    const now = new Date().toISOString();
    await db
      .update(hfDatasets)
      .set({
        status: isCancelError ? "cancelled" : "failed",
        lastError: message,
        updatedAt: now,
      })
      .where(eq(hfDatasets.id, datasetId));

    markFinished(datasetId, isCancelError ? "cancelled" : "failed");
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

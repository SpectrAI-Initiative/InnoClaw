import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import * as path from "path";
import * as fs from "fs";
import { buildManifest, computeStats } from "@/lib/hf-datasets/manifest";

/**
 * POST /api/datasets/import-local - Import a local directory as a dataset
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { localPath, name } = body as {
      localPath: string;
      name?: string;
    };

    if (!localPath) {
      return NextResponse.json({ error: "Missing localPath" }, { status: 400 });
    }

    // Resolve and validate path
    const resolvedPath = path.resolve(localPath);
    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: "Path does not exist" }, { status: 400 });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: "Path must be a directory" }, { status: 400 });
    }

    const displayName = name || path.basename(resolvedPath);
    const id = nanoid();
    const now = new Date().toISOString();

    // Build manifest and stats immediately since files are already local
    const manifest = buildManifest(resolvedPath);
    const stats = computeStats(resolvedPath, manifest);

    // Count total files and size
    let numFiles = 0;
    for (const split of Object.values(manifest.splits)) {
      numFiles += split.numFiles;
    }

    await db.insert(hfDatasets).values({
      id,
      name: displayName,
      repoId: resolvedPath,
      repoType: "dataset",
      source: "local",
      status: "ready",
      progress: 100,
      localPath: resolvedPath,
      sizeBytes: stats.sizeBytes,
      numFiles,
      manifest: JSON.stringify(manifest),
      stats: JSON.stringify(stats),
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const rows = await db.select().from(hfDatasets).where(
      eq(hfDatasets.id, id)
    ).limit(1);

    return NextResponse.json(parseDatasetRow(rows[0]), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import local dataset";
    return NextResponse.json({ error: message }, { status: 500 });
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

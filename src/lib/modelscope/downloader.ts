import * as fs from "fs";
import * as path from "path";
import { minimatch } from "minimatch";
import { listModelScopeFiles, getModelScopeDownloadUrl } from "./metadata";
import {
  setProgress,
  setAbortController,
  isPaused,
} from "@/lib/hf-datasets/progress";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { HfRepoType } from "@/types";

const TAG = "[ModelScope]";

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export interface ModelScopeDownloadConfig {
  repoId: string;
  repoType: HfRepoType;
  revision?: string;
  allowPatterns?: string[];
  ignorePatterns?: string[];
  concurrency?: number;
  retries?: number;
}

export async function downloadModelScopeRepo(
  datasetId: string,
  config: ModelScopeDownloadConfig,
  targetDir: string
): Promise<{ sizeBytes: number; numFiles: number }> {
  const {
    repoId,
    repoType = "dataset",
    revision,
    allowPatterns,
    ignorePatterns,
    concurrency = 4,
    retries = 3,
  } = config;

  const abortController = new AbortController();
  setAbortController(datasetId, abortController);

  setProgress(datasetId, {
    status: "downloading",
    phase: "downloading",
    progress: 0,
  });

  const allFiles = await listModelScopeFiles(repoId, repoType, revision);

  // Apply pattern filtering
  const filteredFiles = allFiles.filter((f) => {
    if (allowPatterns && allowPatterns.length > 0) {
      if (!allowPatterns.some((p) => minimatch(f.path, p))) return false;
    }
    if (ignorePatterns && ignorePatterns.length > 0) {
      if (ignorePatterns.some((p) => minimatch(f.path, p))) return false;
    }
    return true;
  });

  const totalBytes = filteredFiles.reduce((sum, f) => sum + f.size, 0);
  const totalFiles = filteredFiles.length;

  console.log(`${TAG} Download started: ${repoId} → ${totalFiles} files, ${fmtBytes(totalBytes)}`);

  setProgress(datasetId, { totalBytes, totalFiles, downloadedBytes: 0, downloadedFiles: 0 });

  fs.mkdirSync(targetDir, { recursive: true });

  let downloadedBytes = 0;
  let downloadedFiles = 0;
  let lastDbUpdateTime = 0;
  let lastProgressUpdateTime = 0;
  const errors: { path: string; error: Error }[] = [];

  async function processFile(file: { path: string; size: number }) {
    if (abortController.signal.aborted) return;

    const destPath = path.join(targetDir, file.path);
    const resolvedTarget = path.resolve(targetDir);
    const resolvedDest = path.resolve(destPath);
    if (!resolvedDest.startsWith(resolvedTarget + path.sep) && resolvedDest !== resolvedTarget) {
      console.warn(`${TAG}   [skip] ${file.path} — path traversal detected`);
      return;
    }

    // Resume: skip existing files with correct size
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size === file.size) {
        downloadedBytes += file.size;
        downloadedFiles++;
        updateProgress(true);
        return;
      }
    }

    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (abortController.signal.aborted) return;

      try {
        const url = getModelScopeDownloadUrl(repoId, file.path, repoType, revision || "master");
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${file.path}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
        downloadedBytes += file.size;
        downloadedFiles++;
        console.log(`${TAG}   [done] ${file.path} (${fmtBytes(file.size)})`);
        updateProgress(true);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (abortController.signal.aborted) return;
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (lastError) {
      errors.push({ path: file.path, error: lastError });
    }
  }

  function updateProgress(force = false) {
    const now = Date.now();
    if (!force && now - lastProgressUpdateTime < 500) return;
    lastProgressUpdateTime = now;

    const pct = totalBytes > 0
      ? Math.round((downloadedBytes / totalBytes) * 100)
      : (totalFiles > 0 ? Math.round((downloadedFiles / totalFiles) * 100) : 0);

    setProgress(datasetId, {
      progress: Math.min(pct, 99),
      downloadedBytes,
      downloadedFiles,
      totalBytes,
      totalFiles,
    });

    if (now - lastDbUpdateTime > 5000) {
      lastDbUpdateTime = now;
      db.update(hfDatasets)
        .set({ progress: Math.min(pct, 99), updatedAt: new Date().toISOString() })
        .where(eq(hfDatasets.id, datasetId))
        .catch((err) => { console.warn(`${TAG} DB progress update failed:`, err); });
    }
  }

  // Process with concurrency pool
  const executing = new Set<Promise<void>>();
  for (const file of filteredFiles) {
    if (abortController.signal.aborted) break;
    const p = processFile(file).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);

  if (abortController.signal.aborted) {
    if (isPaused(datasetId)) {
      throw new Error("Download paused");
    }
    throw new Error("Download cancelled");
  }

  if (errors.length > 0) {
    throw new Error(`Failed to download ${errors.length} file(s)`);
  }

  console.log(`${TAG} Download complete: ${repoId} — ${totalFiles} files, ${fmtBytes(downloadedBytes)}`);
  return { sizeBytes: downloadedBytes, numFiles: downloadedFiles };
}

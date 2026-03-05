import { downloadFile } from "@huggingface/hub";
import { minimatch } from "minimatch";
import * as fs from "fs";
import * as path from "path";
import { listRepoFiles } from "./metadata";
import {
  setProgress,
  setAbortController,
  isPaused,
} from "./progress";
import { getHfToken } from "./token";
import { db } from "@/lib/db";
import { hfDatasets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { HfRepoType } from "@/types";

const TAG = "[HF]";

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export interface DownloadConfig {
  repoId: string;
  repoType: HfRepoType;
  revision?: string;
  allowPatterns?: string[];
  ignorePatterns?: string[];
  concurrency?: number;
  retries?: number;
  token?: string;
}

/**
 * Download all matching files from a HuggingFace repo to a local directory.
 */
export async function downloadRepo(
  datasetId: string,
  config: DownloadConfig,
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
    token,
  } = config;

  const resolvedToken = token || (await getHfToken());
  const credentials = resolvedToken
    ? { accessToken: resolvedToken }
    : undefined;

  const abortController = new AbortController();
  setAbortController(datasetId, abortController);

  // 1. List all files in the repo
  setProgress(datasetId, {
    status: "downloading",
    phase: "downloading",
    progress: 0,
  });

  const allFiles = await listRepoFiles(repoId, repoType, revision, token);

  // 2. Apply pattern filtering
  const filteredFiles = allFiles.filter((f) => {
    if (allowPatterns && allowPatterns.length > 0) {
      if (!allowPatterns.some((p) => minimatch(f.path, p))) {
        return false;
      }
    }
    if (ignorePatterns && ignorePatterns.length > 0) {
      if (ignorePatterns.some((p) => minimatch(f.path, p))) {
        return false;
      }
    }
    return true;
  });

  const totalBytes = filteredFiles.reduce((sum, f) => sum + f.size, 0);
  const totalFiles = filteredFiles.length;

  console.log(
    `${TAG} Download started: ${repoId} (${repoType}) → ${totalFiles} files, ${fmtBytes(totalBytes)}`
  );
  if (allFiles.length !== totalFiles) {
    console.log(`${TAG}   Filtered: ${allFiles.length} → ${totalFiles} files`);
  }

  setProgress(datasetId, {
    totalBytes,
    totalFiles,
    downloadedBytes: 0,
    downloadedFiles: 0,
  });

  // 3. Ensure target directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  // 4. Download files with concurrency control
  let downloadedBytes = 0;
  let downloadedFiles = 0;
  let lastDbUpdateTime = 0;
  let lastProgressUpdateTime = 0;

  const queue = [...filteredFiles];
  const errors: { path: string; error: Error }[] = [];

  async function processFile(file: { path: string; size: number }) {
    if (abortController.signal.aborted) return;

    const destPath = path.join(targetDir, file.path);
    // Guard against path traversal from malicious repo file paths
    const resolvedTarget = path.resolve(targetDir);
    if (!path.resolve(destPath).startsWith(resolvedTarget + path.sep) && path.resolve(destPath) !== resolvedTarget) {
      console.warn(`${TAG}   [skip] ${file.path} — path traversal detected`);
      return;
    }

    // Resume: skip if file already exists with correct size
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size === file.size) {
        downloadedBytes += file.size;
        downloadedFiles++;
        console.log(`${TAG}   [skip] ${file.path} (${fmtBytes(file.size)}) — already exists`);
        updateProgress(true);
        return;
      }
    }

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (abortController.signal.aborted) return;

      try {
        const response = await downloadFile({
          repo: { type: repoType, name: repoId },
          path: file.path,
          revision: revision || "main",
          credentials,
        });

        if (!response) {
          throw new Error(`No response for file: ${file.path}`);
        }

        // Stream to disk with real-time byte tracking
        await streamBlobToFile(response, destPath, (chunkBytes) => {
          downloadedBytes += chunkBytes;
          updateProgress();
        });

        downloadedFiles++;
        console.log(
          `${TAG}   [done] ${file.path} (${fmtBytes(file.size)}) — ${downloadedFiles}/${totalFiles}`
        );
        updateProgress(true);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (abortController.signal.aborted) return;
        // Exponential backoff
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `${TAG}   [retry] ${file.path} attempt ${attempt + 1}/${retries} — ${lastError.message} (wait ${delay}ms)`
          );
          await sleep(delay);
        }
      }
    }

    errors.push({ path: file.path, error: lastError! });
    console.error(`${TAG}   [fail] ${file.path} — ${lastError!.message}`);
  }

  function updateProgress(force = false) {
    // Throttle in-memory progress updates (streaming produces many small chunks)
    const now = Date.now();
    if (!force && now - lastProgressUpdateTime < 500) return;
    lastProgressUpdateTime = now;

    const pct = totalBytes > 0
      ? Math.round((downloadedBytes / totalBytes) * 100)
      : (totalFiles > 0 ? Math.round((downloadedFiles / totalFiles) * 100) : 0);

    setProgress(datasetId, {
      progress: Math.min(pct, 99), // Reserve 100 for completion
      downloadedBytes,
      downloadedFiles,
      totalBytes,
      totalFiles,
    });

    // Throttled DB progress update + log (every 5 seconds)
    if (now - lastDbUpdateTime > 5000) {
      lastDbUpdateTime = now;
      console.log(
        `${TAG}   [progress] ${pct}% — ${fmtBytes(downloadedBytes)}/${fmtBytes(totalBytes)}, ${downloadedFiles}/${totalFiles} files`
      );
      db.update(hfDatasets)
        .set({ progress: Math.min(pct, 99), updatedAt: new Date().toISOString() })
        .where(eq(hfDatasets.id, datasetId))
        .catch(() => {});
    }
  }

  // Process files with concurrency pool
  const executing = new Set<Promise<void>>();

  for (const file of queue) {
    if (abortController.signal.aborted) break;

    const p = processFile(file).then(() => {
      executing.delete(p);
    });
    executing.add(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);

  if (abortController.signal.aborted) {
    if (isPaused(datasetId)) {
      console.log(`${TAG} Download paused: ${config.repoId} at ${fmtBytes(downloadedBytes)}/${fmtBytes(totalBytes)}`);
      throw new Error("Download paused");
    }
    console.log(`${TAG} Download cancelled: ${config.repoId}`);
    throw new Error("Download cancelled");
  }

  if (errors.length > 0) {
    const failedPaths = errors.map((e) => e.path).join(", ");
    console.error(`${TAG} Download failed: ${errors.length} file(s): ${failedPaths}`);
    throw new Error(`Failed to download ${errors.length} file(s): ${failedPaths}`);
  }

  console.log(
    `${TAG} Download complete: ${config.repoId} — ${totalFiles} files, ${fmtBytes(downloadedBytes)}`
  );
  return { sizeBytes: downloadedBytes, numFiles: downloadedFiles };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stream a Blob to a file, calling onChunk with the byte count
 * of each chunk as it is written to disk.
 */
async function streamBlobToFile(
  blob: Blob,
  destPath: string,
  onChunk: (bytes: number) => void
): Promise<void> {
  const stream = blob.stream();
  const reader = stream.getReader();
  const fileStream = fs.createWriteStream(destPath);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = Buffer.from(value);
      const canContinue = fileStream.write(chunk);
      onChunk(chunk.length);

      // Backpressure: wait for drain if the write buffer is full
      if (!canContinue) {
        await new Promise<void>((resolve) => fileStream.once("drain", resolve));
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      fileStream.end((err: Error | null) => (err ? reject(err) : resolve()));
    });
  }
}

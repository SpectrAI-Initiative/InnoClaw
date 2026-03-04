import { downloadFile } from "@huggingface/hub";
import { minimatch } from "minimatch";
import * as fs from "fs";
import * as path from "path";
import { listRepoFiles } from "./metadata";
import {
  setProgress,
  setAbortController,
  markFinished,
} from "./progress";
import type { HfRepoType, HfDatasetSourceConfig } from "@/types";

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

  const credentials = token || process.env.HF_TOKEN
    ? { accessToken: (token || process.env.HF_TOKEN)! }
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

  const queue = [...filteredFiles];
  const errors: { path: string; error: Error }[] = [];

  async function processFile(file: { path: string; size: number }) {
    if (abortController.signal.aborted) return;

    const destPath = path.join(targetDir, file.path);

    // Resume: skip if file already exists with correct size
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size === file.size) {
        downloadedBytes += file.size;
        downloadedFiles++;
        updateProgress();
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

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(destPath, buffer);

        downloadedBytes += file.size;
        downloadedFiles++;
        updateProgress();
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (abortController.signal.aborted) return;
        // Exponential backoff
        if (attempt < retries) {
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    errors.push({ path: file.path, error: lastError! });
  }

  function updateProgress() {
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
    throw new Error("Download cancelled");
  }

  if (errors.length > 0) {
    const failedPaths = errors.map((e) => e.path).join(", ");
    throw new Error(`Failed to download ${errors.length} file(s): ${failedPaths}`);
  }

  return { sizeBytes: downloadedBytes, numFiles: downloadedFiles };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

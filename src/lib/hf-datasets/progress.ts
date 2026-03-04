import type { HfDatasetStatus, HfDownloadProgress } from "@/types";

interface ProgressEntry {
  progress: HfDownloadProgress;
  abortController: AbortController | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

const store = new Map<string, ProgressEntry>();

const CLEANUP_DELAY_MS = 120_000; // 2 minutes

export function getProgress(datasetId: string): HfDownloadProgress | null {
  return store.get(datasetId)?.progress ?? null;
}

export function setProgress(
  datasetId: string,
  update: Partial<HfDownloadProgress>
): void {
  const existing = store.get(datasetId);
  if (existing) {
    Object.assign(existing.progress, update);
  } else {
    store.set(datasetId, {
      progress: {
        datasetId,
        status: "downloading",
        progress: 0,
        phase: "downloading",
        downloadedBytes: 0,
        totalBytes: 0,
        downloadedFiles: 0,
        totalFiles: 0,
        ...update,
      },
      abortController: null,
      cleanupTimer: null,
    });
  }
}

export function setAbortController(
  datasetId: string,
  controller: AbortController
): void {
  const entry = store.get(datasetId);
  if (entry) {
    entry.abortController = controller;
  }
}

export function cancelDownload(datasetId: string): boolean {
  const entry = store.get(datasetId);
  if (entry?.abortController) {
    entry.abortController.abort();
    entry.progress.status = "cancelled";
    scheduleCleanup(datasetId);
    return true;
  }
  return false;
}

export function markFinished(
  datasetId: string,
  status: HfDatasetStatus
): void {
  const entry = store.get(datasetId);
  if (entry) {
    entry.progress.status = status;
    entry.abortController = null;
    scheduleCleanup(datasetId);
  }
}

export function removeProgress(datasetId: string): void {
  const entry = store.get(datasetId);
  if (entry?.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
  }
  store.delete(datasetId);
}

function scheduleCleanup(datasetId: string): void {
  const entry = store.get(datasetId);
  if (!entry) return;
  if (entry.cleanupTimer) {
    clearTimeout(entry.cleanupTimer);
  }
  entry.cleanupTimer = setTimeout(() => {
    store.delete(datasetId);
  }, CLEANUP_DELAY_MS);
}

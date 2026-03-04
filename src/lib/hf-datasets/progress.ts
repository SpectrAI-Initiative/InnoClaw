import type { HfDatasetStatus, HfDownloadProgress } from "@/types";

interface SpeedTracker {
  lastBytes: number;
  lastTime: number;
  smoothedSpeed: number;
}

interface ProgressEntry {
  progress: HfDownloadProgress;
  abortController: AbortController | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  speedTracker: SpeedTracker | null;
  isPaused: boolean;
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
    const prevBytes = existing.progress.downloadedBytes;
    Object.assign(existing.progress, update);

    // Calculate speed when downloadedBytes changes during downloading phase
    if (
      update.downloadedBytes !== undefined &&
      update.downloadedBytes !== prevBytes &&
      existing.progress.phase === "downloading"
    ) {
      const now = Date.now();
      if (!existing.speedTracker) {
        existing.speedTracker = {
          lastBytes: update.downloadedBytes,
          lastTime: now,
          smoothedSpeed: 0,
        };
      } else {
        const timeDelta = (now - existing.speedTracker.lastTime) / 1000;
        if (timeDelta > 0.5) {
          const bytesDelta = update.downloadedBytes - existing.speedTracker.lastBytes;
          const instantSpeed = bytesDelta / timeDelta;

          // Exponential moving average for smoothing
          existing.speedTracker.smoothedSpeed =
            existing.speedTracker.smoothedSpeed === 0
              ? instantSpeed
              : 0.3 * instantSpeed + 0.7 * existing.speedTracker.smoothedSpeed;

          existing.speedTracker.lastBytes = update.downloadedBytes;
          existing.speedTracker.lastTime = now;

          // Update progress with speed and ETA
          existing.progress.speedBytesPerSecond = Math.round(
            existing.speedTracker.smoothedSpeed
          );

          const remaining =
            existing.progress.totalBytes - update.downloadedBytes;
          if (existing.speedTracker.smoothedSpeed > 0 && remaining > 0) {
            existing.progress.estimatedSecondsRemaining = Math.round(
              remaining / existing.speedTracker.smoothedSpeed
            );
          } else {
            existing.progress.estimatedSecondsRemaining = undefined;
          }
        }
      }
    }
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
      speedTracker: null,
      isPaused: false,
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
    entry.progress.speedBytesPerSecond = undefined;
    entry.progress.estimatedSecondsRemaining = undefined;
    scheduleCleanup(datasetId);
    return true;
  }
  return false;
}

export function pauseDownload(datasetId: string): boolean {
  const entry = store.get(datasetId);
  if (entry?.abortController) {
    entry.isPaused = true;
    entry.abortController.abort();
    entry.progress.status = "paused";
    entry.progress.speedBytesPerSecond = undefined;
    entry.progress.estimatedSecondsRemaining = undefined;
    // Don't schedule cleanup — keep progress in memory for display
    return true;
  }
  return false;
}

export function isPaused(datasetId: string): boolean {
  return store.get(datasetId)?.isPaused ?? false;
}

export function markFinished(
  datasetId: string,
  status: HfDatasetStatus
): void {
  const entry = store.get(datasetId);
  if (entry) {
    entry.progress.status = status;
    entry.progress.speedBytesPerSecond = undefined;
    entry.progress.estimatedSecondsRemaining = undefined;
    entry.abortController = null;
    entry.isPaused = false;
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

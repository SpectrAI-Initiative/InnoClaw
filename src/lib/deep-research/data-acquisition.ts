// =============================================================
// Deep Research — Data Acquisition Module
// =============================================================
// Pure utility functions for acquiring datasets from HuggingFace Hub,
// GitHub repositories, and arbitrary URLs. Generates commands and
// manifests — does NOT execute anything directly.

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

export type DataSource = "huggingface" | "github" | "url";

export interface DataAcquisitionRequest {
  /** Source type. */
  source: DataSource;
  /** Repository ID (e.g. "meta-llama/Llama-3-8B"), dataset ID, or URL. */
  identifier: string;
  /** Optional subset/config name for HF datasets. */
  subset?: string;
  /** Optional split (train/val/test). */
  split?: string;
  /** Expected format of the data. */
  format?: string;
  /** Local cache path to download to. */
  cachePath?: string;
  /** Estimated size in GB. */
  estimatedSizeGb?: number;
  /** Whether to use streaming mode (HF datasets). */
  streaming?: boolean;
  /** HuggingFace token for gated repos. */
  hfToken?: string;
}

export interface DataManifest {
  /** Unique manifest ID. */
  id: string;
  /** Source type. */
  source: DataSource;
  /** Original identifier. */
  identifier: string;
  /** Local path where data is stored. */
  localPath: string;
  /** Data format. */
  format: string;
  /** Size in bytes (populated after download). */
  sizeBytes?: number;
  /** List of files in the download. */
  files: string[];
  /** When the download completed. */
  downloadedAt: string;
  /** Current status. */
  status: "pending" | "downloading" | "ready" | "failed";
  /** Error message if failed. */
  error?: string;
}

export interface DataAcquisitionStep {
  request: DataAcquisitionRequest;
  command: string;
  estimatedDuration: string;
  description: string;
}

// -------------------------------------------------------------------
// HuggingFace download commands
// -------------------------------------------------------------------

/**
 * Generate a shell command to download from HuggingFace.
 * Supports both `datasets` library (for datasets) and `huggingface-cli` (for models/repos).
 */
export function buildHuggingFaceDownloadCommand(request: DataAcquisitionRequest): string {
  const cachePath = request.cachePath ?? `/mnt/data/hf/${sanitizePath(request.identifier)}`;
  const tokenEnv = request.hfToken ? `HF_TOKEN=${request.hfToken} ` : "";

  // Detect if this is a dataset (contains common dataset patterns)
  const isDataset = request.identifier.includes("/") &&
    (request.format === "dataset" ||
      request.identifier.match(/^[a-z0-9_-]+\/[a-z0-9_.-]+$/i) !== null);

  if (request.streaming) {
    // Streaming mode: generate a Python snippet that streams and saves
    const subset = request.subset ? `, "${request.subset}"` : "";
    const split = request.split ?? "train";
    return `${tokenEnv}python3 -c "
from datasets import load_dataset
ds = load_dataset('${request.identifier}'${subset}, split='${split}', streaming=True)
import json
with open('${cachePath}/${split}.jsonl', 'w') as f:
    for i, example in enumerate(ds):
        f.write(json.dumps(example, ensure_ascii=False) + '\\n')
        if i % 10000 == 0:
            print(f'Processed {i} examples...')
print('Done.')
"`;
  }

  if (isDataset || request.format === "dataset") {
    // Use datasets library
    const subset = request.subset ? `, "${request.subset}"` : "";
    const split = request.split ? `, split="${request.split}"` : "";
    return `${tokenEnv}python3 -c "
from datasets import load_dataset
ds = load_dataset('${request.identifier}'${subset}${split})
ds.save_to_disk('${cachePath}')
print(f'Saved to ${cachePath}')
print(f'Features: {ds.features if hasattr(ds, \"features\") else \"N/A\"}')
"`;
  }

  // Default: use huggingface-cli for model/repo downloads
  const tokenFlag = request.hfToken ? ` --token ${request.hfToken}` : "";
  return `huggingface-cli download ${request.identifier} --local-dir ${cachePath}${tokenFlag}`;
}

// -------------------------------------------------------------------
// GitHub download commands
// -------------------------------------------------------------------

/**
 * Generate a shell command to download from GitHub.
 * Handles: release assets (curl), repositories (git clone), and raw files.
 */
export function buildGitHubDownloadCommand(request: DataAcquisitionRequest): string {
  const cachePath = request.cachePath ?? `/mnt/data/github/${sanitizePath(request.identifier)}`;
  const identifier = request.identifier;

  // Release asset URL pattern: github.com/owner/repo/releases/download/tag/file
  if (identifier.includes("/releases/download/")) {
    const filename = identifier.split("/").pop() ?? "download";
    return `mkdir -p ${cachePath} && curl -L -o ${cachePath}/${filename} "${identifier}"`;
  }

  // Raw file URL
  if (identifier.includes("/raw/") || identifier.includes("raw.githubusercontent.com")) {
    const filename = identifier.split("/").pop() ?? "download";
    return `mkdir -p ${cachePath} && curl -L -o ${cachePath}/${filename} "${identifier}"`;
  }

  // Archive URL (.tar.gz, .zip)
  if (identifier.match(/\.(tar\.gz|tgz|zip)$/)) {
    const ext = identifier.match(/\.(tar\.gz|tgz|zip)$/)?.[0] ?? ".tar.gz";
    if (ext === ".zip") {
      return `mkdir -p ${cachePath} && curl -L -o ${cachePath}/archive.zip "${identifier}" && cd ${cachePath} && unzip archive.zip`;
    }
    return `mkdir -p ${cachePath} && curl -L "${identifier}" | tar xzf - -C ${cachePath}`;
  }

  // Default: git clone (shallow)
  const url = identifier.startsWith("http") ? identifier : `https://github.com/${identifier}`;
  return `git clone --depth 1 ${url} ${cachePath}`;
}

// -------------------------------------------------------------------
// Generic URL download
// -------------------------------------------------------------------

/**
 * Generate a download command for an arbitrary URL.
 */
export function buildUrlDownloadCommand(request: DataAcquisitionRequest): string {
  const cachePath = request.cachePath ?? `/mnt/data/downloads/${sanitizePath(request.identifier)}`;
  const filename = request.identifier.split("/").pop() ?? "download";
  return `mkdir -p ${cachePath} && curl -L -o ${cachePath}/${filename} "${request.identifier}"`;
}

// -------------------------------------------------------------------
// Acquisition plan builder
// -------------------------------------------------------------------

/**
 * Build a complete data acquisition plan from a list of requests.
 * Returns ordered steps with commands and time estimates.
 */
export function buildDataAcquisitionPlan(requests: DataAcquisitionRequest[]): DataAcquisitionStep[] {
  return requests.map(request => {
    let command: string;
    let description: string;

    switch (request.source) {
      case "huggingface":
        command = buildHuggingFaceDownloadCommand(request);
        description = `Download from HuggingFace: ${request.identifier}`;
        break;
      case "github":
        command = buildGitHubDownloadCommand(request);
        description = `Download from GitHub: ${request.identifier}`;
        break;
      case "url":
        command = buildUrlDownloadCommand(request);
        description = `Download from URL: ${request.identifier}`;
        break;
      default:
        command = `echo "Unknown source: ${request.source}"`;
        description = `Unknown source: ${request.identifier}`;
    }

    const estimatedDuration = estimateDownloadDuration(request.estimatedSizeGb ?? 1);

    return { request, command, estimatedDuration, description };
  });
}

// -------------------------------------------------------------------
// Manifest management
// -------------------------------------------------------------------

/**
 * Create a DataManifest for a completed or pending download.
 */
export function createDataManifest(
  request: DataAcquisitionRequest,
  localPath: string,
  files: string[],
  status: DataManifest["status"] = "pending",
): DataManifest {
  return {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: request.source,
    identifier: request.identifier,
    localPath,
    format: request.format ?? "unknown",
    files,
    downloadedAt: new Date().toISOString(),
    status,
  };
}

/**
 * Convert a DataManifest to artifact content for storage.
 */
export function dataManifestToArtifact(manifest: DataManifest): Record<string, unknown> {
  return {
    manifestId: manifest.id,
    source: manifest.source,
    identifier: manifest.identifier,
    localPath: manifest.localPath,
    format: manifest.format,
    sizeBytes: manifest.sizeBytes,
    fileCount: manifest.files.length,
    files: manifest.files,
    downloadedAt: manifest.downloadedAt,
    status: manifest.status,
    error: manifest.error,
  };
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function sanitizePath(identifier: string): string {
  return identifier
    .replace(/https?:\/\//g, "")
    .replace(/[^a-zA-Z0-9_\-./]/g, "_")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function estimateDownloadDuration(sizeGb: number): string {
  // Assume ~100MB/s download speed
  const seconds = (sizeGb * 1024) / 100;
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)}min`;
  return `~${(seconds / 3600).toFixed(1)}h`;
}

// =============================================================
// Execution Pipeline — Dataset Acquisition Manager
// =============================================================
// Handles downloading datasets from HuggingFace, GitHub, URLs.
// Supports caching, skip-if-exists, manifests, and checksums.

import type {
  DataSourceSpec,
  DatasetAcquisitionResult,
  ExecutionPipelineConfig,
  ExperimentSpec,
} from "./types";
import {
  buildHuggingFaceDownloadCommand,
  buildGitHubDownloadCommand,
  buildUrlDownloadCommand,
} from "./data-acquisition";
import type { DataAcquisitionRequest } from "./data-acquisition";

// -------------------------------------------------------------------
// Download command builder
// -------------------------------------------------------------------

/**
 * Convert a DataSourceSpec to the command that would download it.
 */
export function buildDownloadCommand(source: DataSourceSpec): string {
  switch (source.source) {
    case "huggingface": {
      const req: DataAcquisitionRequest = {
        source: "huggingface",
        identifier: source.identifier,
        subset: source.subset,
        split: source.split,
        format: source.format,
        cachePath: source.cachePath,
        streaming: false,
      };
      return buildHuggingFaceDownloadCommand(req);
    }
    case "github": {
      const req: DataAcquisitionRequest = {
        source: "github",
        identifier: source.identifier,
        cachePath: source.cachePath,
      };
      return buildGitHubDownloadCommand(req);
    }
    case "url": {
      const req: DataAcquisitionRequest = {
        source: "url",
        identifier: source.identifier,
        cachePath: source.cachePath,
      };
      return buildUrlDownloadCommand(req);
    }
    case "local":
      return `# Local source: ${source.identifier} → no download needed`;
    default:
      return `echo "Unknown source type: ${source.source}"`;
  }
}

// -------------------------------------------------------------------
// File existence check (pure utility)
// -------------------------------------------------------------------

/**
 * Check if a cache path appears to have data.
 * In production this checks the filesystem; tests can override.
 */
export type FileExistenceChecker = (path: string) => boolean;

let fileExistsChecker: FileExistenceChecker = defaultFileExists;

export function setFileExistenceChecker(checker: FileExistenceChecker): void {
  fileExistsChecker = checker;
}

export function resetFileExistenceChecker(): void {
  fileExistsChecker = defaultFileExists;
}

function defaultFileExists(path: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    const stat = fs.statSync(path);
    return stat.isDirectory() ? fs.readdirSync(path).length > 0 : stat.size > 0;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------
// Dataset acquisition plan
// -------------------------------------------------------------------

export interface DatasetAcquisitionPlan {
  sources: Array<{
    source: DataSourceSpec;
    command: string;
    willSkip: boolean;
    skipReason?: string;
    estimatedDuration: string;
  }>;
  totalSources: number;
  sourcesToDownload: number;
  sourcesToSkip: number;
}

/**
 * Build an acquisition plan for all data sources in an experiment.
 * Determines which sources need downloading and which can be skipped.
 */
export function buildDatasetAcquisitionPlan(
  spec: ExperimentSpec,
  config: ExecutionPipelineConfig,
): DatasetAcquisitionPlan {
  const sources = spec.dataSources.map(source => {
    const command = buildDownloadCommand(source);
    let willSkip = false;
    let skipReason: string | undefined;

    // Check if data already exists
    if (config.skipExistingData && source.cachePath) {
      if (fileExistsChecker(source.cachePath)) {
        willSkip = true;
        skipReason = `Data already exists at ${source.cachePath}`;
      }
    }

    // Local sources are always "skip"
    if (source.source === "local") {
      willSkip = true;
      skipReason = "Local source — no download needed";
    }

    // Estimate duration based on size
    const gbPerMinute = 0.5; // Conservative estimate
    const minutes = Math.ceil((source.estimatedSizeGb || 1) / gbPerMinute);
    const estimatedDuration = minutes < 60 ? `~${minutes} min` : `~${(minutes / 60).toFixed(1)} hr`;

    return { source, command, willSkip, skipReason, estimatedDuration };
  });

  return {
    sources,
    totalSources: sources.length,
    sourcesToDownload: sources.filter(s => !s.willSkip).length,
    sourcesToSkip: sources.filter(s => s.willSkip).length,
  };
}

// -------------------------------------------------------------------
// Execute acquisition (production uses child_process, tests use mock)
// -------------------------------------------------------------------

export type CommandExecutor = (command: string, opts?: { timeout?: number }) => Promise<{ stdout: string; exitCode: number }>;

let commandExecutor: CommandExecutor = defaultCommandExecutor;

export function setCommandExecutor(executor: CommandExecutor): void {
  commandExecutor = executor;
}

export function resetCommandExecutor(): void {
  commandExecutor = defaultCommandExecutor;
}

async function defaultCommandExecutor(
  command: string,
  opts?: { timeout?: number },
): Promise<{ stdout: string; exitCode: number }> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { exec } = require("child_process");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { promisify } = require("util");
  const execAsync = promisify(exec);

  try {
    const { stdout } = await execAsync(command, {
      timeout: opts?.timeout ?? 600_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: stdout ?? "", exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { code?: number; stderr?: string; message?: string };
    return {
      stdout: err.stderr ?? err.message ?? "Unknown error",
      exitCode: err.code ?? 1,
    };
  }
}

/**
 * Execute the full dataset acquisition for an experiment.
 * Downloads each source that isn't cached.
 */
export async function executeDatasetAcquisition(
  spec: ExperimentSpec,
  config: ExecutionPipelineConfig,
): Promise<DatasetAcquisitionResult[]> {
  const plan = buildDatasetAcquisitionPlan(spec, config);
  const results: DatasetAcquisitionResult[] = [];

  for (const entry of plan.sources) {
    if (entry.willSkip) {
      results.push({
        sourceId: entry.source.id,
        source: entry.source,
        status: "skipped",
        localPath: entry.source.cachePath,
        skippedReason: entry.skipReason,
        command: entry.command,
      });
      continue;
    }

    // Execute download
    try {
      const { stdout, exitCode } = await commandExecutor(entry.command, {
        timeout: 3600_000, // 1 hour max per download
      });

      if (exitCode !== 0) {
        results.push({
          sourceId: entry.source.id,
          source: entry.source,
          status: "failed",
          localPath: entry.source.cachePath,
          error: `Download failed (exit ${exitCode}): ${stdout.slice(0, 500)}`,
          command: entry.command,
        });
        continue;
      }

      results.push({
        sourceId: entry.source.id,
        source: entry.source,
        status: "ready",
        localPath: entry.source.cachePath,
        downloadedAt: new Date().toISOString(),
        command: entry.command,
      });
    } catch (error) {
      results.push({
        sourceId: entry.source.id,
        source: entry.source,
        status: "failed",
        localPath: entry.source.cachePath,
        error: error instanceof Error ? error.message : "Download failed",
        command: entry.command,
      });
    }
  }

  return results;
}

/**
 * Create a dataset manifest from acquisition results.
 */
export function createDatasetManifest(
  results: DatasetAcquisitionResult[],
): Record<string, unknown> {
  return {
    totalSources: results.length,
    ready: results.filter(r => r.status === "ready").length,
    skipped: results.filter(r => r.status === "skipped").length,
    failed: results.filter(r => r.status === "failed").length,
    sources: results.map(r => ({
      id: r.sourceId,
      identifier: r.source.identifier,
      source: r.source.source,
      status: r.status,
      localPath: r.localPath,
      sizeBytes: r.sizeBytes,
      checksum: r.checksum,
      downloadedAt: r.downloadedAt,
      error: r.error,
    })),
    createdAt: new Date().toISOString(),
  };
}

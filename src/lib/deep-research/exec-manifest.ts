// =============================================================
// Execution Pipeline — Experiment Manifest Tracking
// =============================================================
// Unified manifest system for recording exact experiment state
// for reproducibility and auditability.

import type {
  ExperimentSpec,
  ExperimentManifest,
  ExperimentStatus,
  DatasetAcquisitionResult,
  PreprocessingRunResult,
  JobSubmissionResult,
} from "./types";

// -------------------------------------------------------------------
// Manifest creation
// -------------------------------------------------------------------

/**
 * Create an initial experiment manifest from a spec.
 * This records the starting state before execution.
 */
export function createExperimentManifest(spec: ExperimentSpec): ExperimentManifest {
  return {
    experimentId: spec.experimentId,
    sessionId: spec.sessionId,
    createdAt: new Date().toISOString(),

    datasets: spec.dataSources.map(ds => ({
      sourceId: ds.id,
      identifier: ds.identifier,
      revision: ds.revision,
      localPath: ds.cachePath,
    })),

    preprocessingConfig: spec.preprocessing,

    executionConfig: {
      resources: spec.resources,
      environment: spec.environment,
      commands: spec.commands,
      launcherType: spec.launcherType,
    },

    outputPaths: spec.outputs,
    status: spec.status,
  };
}

/**
 * Update manifest with dataset acquisition results.
 */
export function updateManifestWithDatasets(
  manifest: ExperimentManifest,
  results: DatasetAcquisitionResult[],
): ExperimentManifest {
  return {
    ...manifest,
    datasets: manifest.datasets.map(ds => {
      const result = results.find(r => r.sourceId === ds.sourceId);
      if (!result) return ds;
      return {
        ...ds,
        localPath: result.localPath,
        checksum: result.checksum,
      };
    }),
    status: results.every(r => r.status === "ready" || r.status === "skipped")
      ? "data_ready"
      : results.some(r => r.status === "failed")
        ? "failed"
        : "data_downloading",
  };
}

/**
 * Update manifest with preprocessing results.
 */
export function updateManifestWithPreprocessing(
  manifest: ExperimentManifest,
  result: PreprocessingRunResult,
): ExperimentManifest {
  return {
    ...manifest,
    status: result.overallStatus === "completed" || result.overallStatus === "skipped"
      ? "preprocess_ready"
      : "failed",
  };
}

/**
 * Update manifest with job submission result.
 */
export function updateManifestWithSubmission(
  manifest: ExperimentManifest,
  result: JobSubmissionResult,
): ExperimentManifest {
  return {
    ...manifest,
    jobSubmission: result,
    status: result.success
      ? (result.mode === "dry_run" ? "dry_run" : "submitted")
      : "failed",
    startedAt: result.success ? result.submittedAt : undefined,
  };
}

/**
 * Mark manifest as completed with evaluation summary.
 */
export function finalizeManifest(
  manifest: ExperimentManifest,
  status: ExperimentStatus,
  evaluationSummary?: Record<string, unknown>,
): ExperimentManifest {
  return {
    ...manifest,
    status,
    evaluationSummary,
    completedAt: new Date().toISOString(),
  };
}

// -------------------------------------------------------------------
// Manifest serialization
// -------------------------------------------------------------------

/**
 * Render manifest as human-readable text.
 */
export function renderManifestSummary(manifest: ExperimentManifest): string {
  const lines: string[] = [];
  lines.push(`# Experiment Manifest: ${manifest.experimentId}`);
  lines.push(`Session: ${manifest.sessionId}`);
  lines.push(`Status: ${manifest.status}`);
  lines.push(`Created: ${manifest.createdAt}`);
  if (manifest.completedAt) lines.push(`Completed: ${manifest.completedAt}`);
  lines.push("");

  lines.push("## Datasets");
  for (const ds of manifest.datasets) {
    lines.push(`  - ${ds.sourceId}: ${ds.identifier} → ${ds.localPath}${ds.checksum ? ` (${ds.checksum})` : ""}`);
  }
  lines.push("");

  lines.push("## Preprocessing");
  lines.push(`  Enabled: ${manifest.preprocessingConfig.enabled}`);
  lines.push(`  Steps: ${manifest.preprocessingConfig.steps.length}`);
  lines.push(`  Output: ${manifest.preprocessingConfig.outputPath}`);
  lines.push("");

  lines.push("## Execution");
  lines.push(`  Launcher: ${manifest.executionConfig.launcherType}`);
  lines.push(`  GPU: ${manifest.executionConfig.resources.gpu}`);
  lines.push(`  Memory: ${manifest.executionConfig.resources.memoryMb} MB`);
  lines.push(`  Commands: ${manifest.executionConfig.commands.length}`);
  lines.push("");

  if (manifest.jobSubmission) {
    lines.push("## Job Submission");
    lines.push(`  Job ID: ${manifest.jobSubmission.jobId ?? "N/A"}`);
    lines.push(`  Mode: ${manifest.jobSubmission.mode}`);
    lines.push(`  Success: ${manifest.jobSubmission.success}`);
    lines.push(`  Message: ${manifest.jobSubmission.message}`);
    lines.push("");
  }

  lines.push("## Outputs");
  lines.push(`  Base: ${manifest.outputPaths.baseDir}`);
  lines.push(`  Checkpoints: ${manifest.outputPaths.checkpointDir}`);
  lines.push(`  Logs: ${manifest.outputPaths.logDir}`);
  lines.push(`  Metrics: ${manifest.outputPaths.metricsDir}`);

  if (manifest.evaluationSummary) {
    lines.push("");
    lines.push("## Evaluation");
    lines.push(`  ${JSON.stringify(manifest.evaluationSummary, null, 2)}`);
  }

  return lines.join("\n");
}

/**
 * Serialize manifest to JSON (for storage as artifact).
 */
export function manifestToArtifactContent(manifest: ExperimentManifest): Record<string, unknown> {
  return manifest as unknown as Record<string, unknown>;
}

// =============================================================
// Execution Pipeline — Main Orchestrator
// =============================================================
// Wires the full path: plan → data → preprocess → job spec → submit.
// Produces an ExperimentManifest at every stage for tracking.

import type {
  ExperimentSpec,
  ExperimentManifest,
  ExperimentStatus,
  ExecutionPipelineConfig,
  DatasetAcquisitionResult,
  PreprocessingRunResult,
  JobSubmissionResult,
  DryRunResult,
  SubmissionMode,
  ValidationPlan,
  DeepResearchSession,
  DeepResearchArtifact,
  ExperimentGroup,
  WorkerFanoutPlan,
  ExecutionRound,
  ExecutionLineage,
  ExecutionValidationResult,
  ExperimentAnalysisResult,
  AggregatedResult,
} from "./types";
import { DEFAULT_EXECUTION_PIPELINE_CONFIG } from "./types";
import { resolveConfig, resolveResources, resolveEnvironment, experimentOutputPath, preprocessingOutputPath, datasetCachePath } from "./exec-config";
import { MockSubmissionAdapter, RJobSubmissionAdapter, getSubmissionAdapter, renderJobSpec } from "./exec-job-submitter";
import type { SubmissionAdapter } from "./exec-job-submitter";
import { buildDatasetAcquisitionPlan, executeDatasetAcquisition, createDatasetManifest } from "./exec-dataset-manager";
import { executePreprocessingPipeline, generatePreprocessingManifest } from "./exec-preprocess-runner";
import { createExperimentManifest, updateManifestWithDatasets, updateManifestWithPreprocessing, updateManifestWithSubmission, finalizeManifest, renderManifestSummary } from "./exec-manifest";
import { checkExecutionReadiness, generateDryRun } from "./exec-readiness";
import {
  buildExperimentGroup,
  submitGroupWorkers,
  pollWorkerStatuses,
  collectWorkerResults,
  createExecutionRound,
  validateAndAnalyzeRound,
  createExecutionLineage,
  addRoundToLineage,
  checkStopConditions,
  buildSimpleFanoutPlan,
} from "./execution-round-manager";
import { aggregateWorkerResults, computeGroupStatus } from "./worker-aggregator";
import { validateExperimentResults } from "./execution-validator";
import { analyzeExperimentFailure } from "./experiment-analysis";

// -------------------------------------------------------------------
// Spec builder — converts a validation plan to an ExperimentSpec
// -------------------------------------------------------------------

let specCounter = 0;

export function resetSpecCounter(): void {
  specCounter = 0;
}

/**
 * Build an ExperimentSpec from a ValidationPlan and session context.
 * This is the bridge between the research planning layer and the execution layer.
 */
export function buildExperimentSpec(
  session: DeepResearchSession,
  validationPlan: ValidationPlan,
  config?: Partial<ExecutionPipelineConfig>,
  overrides?: Partial<ExperimentSpec>,
): ExperimentSpec {
  const pipelineConfig = resolveConfig(config);
  specCounter++;
  const experimentId = overrides?.experimentId ?? `exp-${session.id}-${specCounter}`;
  const outputBase = experimentOutputPath(pipelineConfig, experimentId);
  const preprocBase = preprocessingOutputPath(pipelineConfig, experimentId);

  // Extract datasets from validation plan
  const dataSources = validationPlan.datasets.map((ds, i) => ({
    id: `ds-${i}`,
    name: ds,
    source: inferDataSource(ds),
    identifier: ds,
    estimatedSizeGb: 1,
    cachePath: datasetCachePath(pipelineConfig, `ds-${i}-${sanitize(ds)}`),
  }));

  // Extract commands from validation steps
  const commands = validationPlan.steps.map((step, i) => ({
    name: step.description,
    command: step.command ?? step.scriptPath ?? "echo",
    args: step.command ? [] : [step.scriptPath ?? "no-command"],
    stage: inferStage(step.description) as "setup" | "train" | "eval" | "postprocess",
    dependsOn: i > 0 ? [validationPlan.steps[i - 1].description] : [],
  }));

  const resources = resolveResources(pipelineConfig.defaultResources, {
    gpu: validationPlan.requiredResources.gpu,
    memoryMb: validationPlan.requiredResources.memoryMb,
    cpu: validationPlan.requiredResources.cpu,
  });

  const environment = resolveEnvironment(pipelineConfig.defaultEnvironment ?? {}, {
    workingDir: outputBase,
  });

  return {
    experimentId,
    sessionId: session.id,
    name: validationPlan.objective,
    description: validationPlan.hypothesis,
    scale: "pilot",
    status: "planning",
    taskType: inferTaskType(validationPlan),
    models: [],
    dataSources,
    preprocessing: {
      enabled: dataSources.length > 0,
      steps: buildDefaultPreprocessingSteps(),
      outputPath: preprocBase,
      outputFormat: "jsonl",
      skipIfCached: pipelineConfig.skipExistingPreprocessing,
    },
    commands,
    resources,
    mounts: pipelineConfig.defaultMounts,
    environment,
    outputs: {
      baseDir: outputBase,
      checkpointDir: `${outputBase}/checkpoints`,
      logDir: `${outputBase}/logs`,
      metricsDir: `${outputBase}/metrics`,
      artifactPatterns: ["*.json", "*.pt", "*.safetensors", "*.log"],
    },
    retryPolicy: pipelineConfig.defaultRetryPolicy,
    submissionMode: "dry_run",
    launcherType: pipelineConfig.defaultLauncherType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function inferDataSource(ds: string): "huggingface" | "github" | "url" | "local" {
  if (ds.startsWith("/") || ds.startsWith("./")) return "local";
  if (ds.includes("github.com")) return "github";
  if (ds.includes("huggingface.co") || ds.match(/^[\w-]+\/[\w-]+$/) || ds.includes("hf://")) return "huggingface";
  if (ds.startsWith("http")) return "url";
  return "huggingface";
}

function inferStage(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes("train") || lower.includes("fine-tune") || lower.includes("finetune")) return "train";
  if (lower.includes("eval") || lower.includes("test") || lower.includes("benchmark")) return "eval";
  if (lower.includes("setup") || lower.includes("install") || lower.includes("download")) return "setup";
  return "train";
}

function inferTaskType(plan: ValidationPlan): string {
  const text = `${plan.objective} ${plan.hypothesis}`.toLowerCase();
  if (text.includes("train")) return "training";
  if (text.includes("fine-tune") || text.includes("finetune")) return "fine_tuning";
  if (text.includes("eval")) return "evaluation";
  if (text.includes("preprocess")) return "preprocessing";
  return "training";
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

function buildDefaultPreprocessingSteps(): ExperimentSpec["preprocessing"]["steps"] {
  return [
    {
      order: 1,
      name: "validate",
      type: "validate",
      config: { requiredFields: ["text"] },
      description: "Validate input records have required fields",
    },
    {
      order: 2,
      name: "dedup",
      type: "dedup",
      config: { method: "exact", fields: ["text"] },
      description: "Remove exact duplicates",
    },
    {
      order: 3,
      name: "filter",
      type: "filter",
      config: { field: "text", minLength: 10 },
      description: "Filter records with minimum text length",
    },
  ];
}

// -------------------------------------------------------------------
// Pipeline execution — the main orchestration path
// -------------------------------------------------------------------

export interface PipelineResult {
  experimentId: string;
  manifest: ExperimentManifest;
  dataResults: DatasetAcquisitionResult[];
  preprocessingResult: PreprocessingRunResult | null;
  submissionResult: JobSubmissionResult | null;
  dryRun: DryRunResult | null;
  status: ExperimentStatus;
  log: PipelineLogEntry[];
}

export interface PipelineLogEntry {
  timestamp: string;
  stage: string;
  message: string;
  level: "info" | "warn" | "error";
}

/**
 * Execute the full pipeline: data → preprocess → submit.
 *
 * If submissionMode is "dry_run", stops before actual submission.
 * If submissionMode is "mock", uses the mock adapter for testing.
 */
export async function executePipeline(
  spec: ExperimentSpec,
  config?: Partial<ExecutionPipelineConfig>,
): Promise<PipelineResult> {
  const pipelineConfig = resolveConfig(config);
  const log: PipelineLogEntry[] = [];
  const addLog = (stage: string, message: string, level: PipelineLogEntry["level"] = "info") => {
    log.push({ timestamp: new Date().toISOString(), stage, message, level });
  };

  // Initialize manifest
  let manifest = createExperimentManifest(spec);
  addLog("init", `Pipeline started for ${spec.name} (${spec.scale})`);

  // Step 1: Readiness check
  const readiness = checkExecutionReadiness(spec, pipelineConfig);
  if (!readiness.ready) {
    addLog("readiness", `Blocked: ${readiness.blockers.map(b => b.issue).join("; ")}`, "error");
    return {
      experimentId: spec.experimentId,
      manifest: finalizeManifest(manifest, "failed"),
      dataResults: [],
      preprocessingResult: null,
      submissionResult: null,
      dryRun: null,
      status: "failed",
      log,
    };
  }
  addLog("readiness", "All readiness checks passed");

  // Step 2: Generate dry-run if requested
  let dryRun: DryRunResult | null = null;
  if (spec.submissionMode === "dry_run") {
    dryRun = generateDryRun(spec, pipelineConfig);
    addLog("dry_run", `Dry-run generated: ${dryRun.readyToSubmit ? "ready" : "not ready"}`);
    if (dryRun.blockers.length > 0) {
      addLog("dry_run", `Blockers: ${dryRun.blockers.join("; ")}`, "warn");
    }
    manifest = finalizeManifest(manifest, "dry_run");
    return {
      experimentId: spec.experimentId,
      manifest,
      dataResults: [],
      preprocessingResult: null,
      submissionResult: null,
      dryRun,
      status: "dry_run",
      log,
    };
  }

  // Step 3: Dataset acquisition
  addLog("data", `Acquiring ${spec.dataSources.length} dataset(s)...`);
  let dataResults: DatasetAcquisitionResult[] = [];
  try {
    dataResults = await executeDatasetAcquisition(spec, pipelineConfig);
    manifest = updateManifestWithDatasets(manifest, dataResults);

    const failed = dataResults.filter(r => r.status === "failed");
    if (failed.length > 0) {
      addLog("data", `${failed.length} dataset(s) failed to download`, "error");
      return {
        experimentId: spec.experimentId,
        manifest: finalizeManifest(manifest, "failed"),
        dataResults,
        preprocessingResult: null,
        submissionResult: null,
        dryRun: null,
        status: "failed",
        log,
      };
    }
    addLog("data", `All datasets acquired (${dataResults.filter(r => r.status === "ready").length} downloaded, ${dataResults.filter(r => r.status === "skipped").length} cached)`);
  } catch (error) {
    addLog("data", `Dataset acquisition failed: ${error instanceof Error ? error.message : "unknown"}`, "error");
    return {
      experimentId: spec.experimentId,
      manifest: finalizeManifest(manifest, "failed"),
      dataResults,
      preprocessingResult: null,
      submissionResult: null,
      dryRun: null,
      status: "failed",
      log,
    };
  }

  // Step 4: Preprocessing
  let preprocessingResult: PreprocessingRunResult | null = null;
  if (spec.preprocessing.enabled && spec.preprocessing.steps.length > 0) {
    addLog("preprocess", `Running ${spec.preprocessing.steps.length} preprocessing step(s)...`);
    try {
      preprocessingResult = await executePreprocessingPipeline(spec, pipelineConfig);
      manifest = updateManifestWithPreprocessing(manifest, preprocessingResult);

      if (preprocessingResult.overallStatus === "failed") {
        const failedStep = preprocessingResult.steps.find(s => s.status === "failed");
        addLog("preprocess", `Preprocessing failed at step "${failedStep?.stepName}": ${failedStep?.error}`, "error");
        return {
          experimentId: spec.experimentId,
          manifest: finalizeManifest(manifest, "failed"),
          dataResults,
          preprocessingResult,
          submissionResult: null,
          dryRun: null,
          status: "failed",
          log,
        };
      }
      addLog("preprocess", `Preprocessing completed (${preprocessingResult.steps.filter(s => s.status === "completed").length} run, ${preprocessingResult.steps.filter(s => s.status === "skipped").length} skipped)`);
    } catch (error) {
      addLog("preprocess", `Preprocessing failed: ${error instanceof Error ? error.message : "unknown"}`, "error");
      return {
        experimentId: spec.experimentId,
        manifest: finalizeManifest(manifest, "failed"),
        dataResults,
        preprocessingResult,
        submissionResult: null,
        dryRun: null,
        status: "failed",
        log,
      };
    }
  } else {
    addLog("preprocess", "No preprocessing required");
  }

  // Step 5: Job submission
  addLog("submit", `Submitting via ${spec.launcherType} (mode: ${spec.submissionMode})`);
  const adapter = spec.submissionMode === "mock"
    ? new MockSubmissionAdapter()
    : getSubmissionAdapter(spec.launcherType);

  let submissionResult: JobSubmissionResult;
  try {
    submissionResult = await adapter.submit(spec, spec.submissionMode);
    manifest = updateManifestWithSubmission(manifest, submissionResult);

    if (!submissionResult.success) {
      addLog("submit", `Submission failed: ${submissionResult.message}`, "error");
      return {
        experimentId: spec.experimentId,
        manifest: finalizeManifest(manifest, "failed"),
        dataResults,
        preprocessingResult,
        submissionResult,
        dryRun: null,
        status: "failed",
        log,
      };
    }
    addLog("submit", `Job submitted: ${submissionResult.jobId ?? "N/A"} (${submissionResult.mode})`);
  } catch (error) {
    addLog("submit", `Submission error: ${error instanceof Error ? error.message : "unknown"}`, "error");
    return {
      experimentId: spec.experimentId,
      manifest: finalizeManifest(manifest, "failed"),
      dataResults,
      preprocessingResult,
      submissionResult: null,
      dryRun: null,
      status: "failed",
      log,
    };
  }

  const finalStatus: ExperimentStatus = submissionResult.mode === "mock" ? "submitted" : "submitted";
  addLog("complete", `Pipeline completed — status: ${finalStatus}`);

  return {
    experimentId: spec.experimentId,
    manifest: finalizeManifest(manifest, finalStatus),
    dataResults,
    preprocessingResult,
    submissionResult,
    dryRun: null,
    status: finalStatus,
    log,
  };
}

// -------------------------------------------------------------------
// Convenience entry points
// -------------------------------------------------------------------

/**
 * Generate an execution plan from a session's validation plan (dry-run only).
 */
export function generateExecutionSpec(
  session: DeepResearchSession,
  validationPlan: ValidationPlan,
  config?: Partial<ExecutionPipelineConfig>,
): { spec: ExperimentSpec; dryRun: DryRunResult; readiness: ReturnType<typeof checkExecutionReadiness> } {
  const spec = buildExperimentSpec(session, validationPlan, config, {
    submissionMode: "dry_run",
  });
  const pipelineConfig = resolveConfig(config);
  const readiness = checkExecutionReadiness(spec, pipelineConfig);
  const dryRun = generateDryRun(spec, pipelineConfig);
  return { spec, dryRun, readiness };
}

/**
 * Preview what datasets need to be fetched.
 */
export function previewDataAcquisition(
  spec: ExperimentSpec,
  config?: Partial<ExecutionPipelineConfig>,
) {
  const pipelineConfig = resolveConfig(config);
  return buildDatasetAcquisitionPlan(spec, pipelineConfig);
}

/**
 * Inspect the rendered job spec without submitting.
 */
export function inspectJobSpec(spec: ExperimentSpec): string {
  return renderJobSpec(spec);
}

// -------------------------------------------------------------------
// Grouped Execution Pipeline — Multi-worker with validation loop
// -------------------------------------------------------------------

export interface GroupedPipelineResult {
  experimentId: string;
  group: ExperimentGroup;
  aggregated: AggregatedResult | null;
  validationResult: ExecutionValidationResult | null;
  analysisResult: ExperimentAnalysisResult | null;
  dataResults: DatasetAcquisitionResult[];
  preprocessingResult: PreprocessingRunResult | null;
  status: "completed" | "failed" | "partially_failed" | "validated" | "inconclusive";
  log: PipelineLogEntry[];
}

/**
 * Execute a full grouped pipeline:
 *   1. Acquire data (shared across workers)
 *   2. Preprocess (shared)
 *   3. Build worker group from fanout plan
 *   4. Submit all workers
 *   5. Poll until all complete
 *   6. Collect results
 *   7. Aggregate
 *   8. Validate
 *   9. Analyze if failed
 */
export async function executeGroupedPipeline(
  fanoutPlan: WorkerFanoutPlan,
  config?: Partial<ExecutionPipelineConfig>,
  adapter?: SubmissionAdapter,
): Promise<GroupedPipelineResult> {
  const pipelineConfig = resolveConfig(config);
  const log: PipelineLogEntry[] = [];
  const addLog = (stage: string, message: string, level: PipelineLogEntry["level"] = "info") => {
    log.push({ timestamp: new Date().toISOString(), stage, message, level });
  };

  const parentSpec = fanoutPlan.parentSpec;
  addLog("init", `Grouped pipeline started: ${parentSpec.name} (${fanoutPlan.totalWorkers} workers, strategy=${fanoutPlan.strategy})`);

  // Step 1: Readiness check
  const readiness = checkExecutionReadiness(parentSpec, pipelineConfig);
  if (!readiness.ready) {
    addLog("readiness", `Blocked: ${readiness.blockers.map(b => b.issue).join("; ")}`, "error");
    return makeFailedGroupResult(parentSpec.experimentId, [], null, log);
  }

  // Step 2: Data acquisition (shared)
  let dataResults: DatasetAcquisitionResult[] = [];
  if (parentSpec.submissionMode !== "dry_run") {
    addLog("data", `Acquiring ${parentSpec.dataSources.length} dataset(s)...`);
    try {
      dataResults = await executeDatasetAcquisition(parentSpec, pipelineConfig);
      const failed = dataResults.filter(r => r.status === "failed");
      if (failed.length > 0) {
        addLog("data", `${failed.length} dataset(s) failed`, "error");
        return makeFailedGroupResult(parentSpec.experimentId, dataResults, null, log);
      }
      addLog("data", `All datasets acquired`);
    } catch (error) {
      addLog("data", `Dataset acquisition failed: ${error instanceof Error ? error.message : "unknown"}`, "error");
      return makeFailedGroupResult(parentSpec.experimentId, dataResults, null, log);
    }
  }

  // Step 3: Preprocessing (shared)
  let preprocessingResult: PreprocessingRunResult | null = null;
  if (parentSpec.preprocessing.enabled && parentSpec.preprocessing.steps.length > 0 && parentSpec.submissionMode !== "dry_run") {
    addLog("preprocess", `Running preprocessing...`);
    try {
      preprocessingResult = await executePreprocessingPipeline(parentSpec, pipelineConfig);
      if (preprocessingResult.overallStatus === "failed") {
        addLog("preprocess", "Preprocessing failed", "error");
        return makeFailedGroupResult(parentSpec.experimentId, dataResults, preprocessingResult, log);
      }
      addLog("preprocess", "Preprocessing completed");
    } catch (error) {
      addLog("preprocess", `Preprocessing error: ${error instanceof Error ? error.message : "unknown"}`, "error");
      return makeFailedGroupResult(parentSpec.experimentId, dataResults, preprocessingResult, log);
    }
  }

  // Step 4: Build experiment group
  const group = buildExperimentGroup(parentSpec.sessionId, 1, fanoutPlan);
  addLog("group", `Created experiment group: ${group.groupId} with ${group.workers.length} workers`);

  // Step 5: Submit workers
  const effectiveAdapter = adapter ??
    (parentSpec.submissionMode === "mock" ? new MockSubmissionAdapter() : getSubmissionAdapter(parentSpec.launcherType));

  let currentGroup = await submitGroupWorkers(group, effectiveAdapter, parentSpec.submissionMode, fanoutPlan.maxParallel);
  const submittedCount = currentGroup.workers.filter(w => w.status !== "pending").length;
  addLog("submit", `Submitted ${submittedCount}/${currentGroup.workers.length} workers via ${parentSpec.launcherType}`);

  // Step 6: Poll until all workers complete (with timeout protection)
  const maxPolls = 100;
  let pollCount = 0;
  while (pollCount < maxPolls) {
    const activeWorkers = currentGroup.workers.filter(
      w => w.status === "queued" || w.status === "running"
    );
    if (activeWorkers.length === 0) break;

    currentGroup = await pollWorkerStatuses(currentGroup, effectiveAdapter);

    // Submit any newly-unblocked workers (for sequential deps)
    const pendingWithReadyDeps = currentGroup.workers.filter(w => {
      if (w.status !== "pending") return false;
      const deps = currentGroup.dependencyGraph[w.workerId] ?? [];
      return deps.every(d => {
        const dep = currentGroup.workers.find(ww => ww.workerId === d);
        return dep && dep.status === "completed";
      });
    });
    if (pendingWithReadyDeps.length > 0) {
      currentGroup = await submitGroupWorkers(currentGroup, effectiveAdapter, parentSpec.submissionMode, fanoutPlan.maxParallel);
    }

    pollCount++;
    // In real execution, we'd await a delay here; for mock/testing, the poll loop terminates quickly
  }

  addLog("monitor", `All workers finished. Poll cycles: ${pollCount}`);

  // Step 7: Collect results
  currentGroup = await collectWorkerResults(currentGroup);
  const succeeded = currentGroup.workers.filter(w => w.status === "completed").length;
  const failed = currentGroup.workers.filter(w => w.status === "failed").length;
  addLog("collect", `Results collected: ${succeeded} succeeded, ${failed} failed`);

  // Step 8: Aggregate
  currentGroup.status = computeGroupStatus(currentGroup);
  const aggregated = aggregateWorkerResults(currentGroup);
  currentGroup.aggregatedResult = aggregated;
  addLog("aggregate", `Aggregated ${Object.keys(aggregated.metrics).length} metrics from ${aggregated.succeededWorkers} workers`);

  // Step 9: Validate
  const validationResult = validateExperimentResults(currentGroup, aggregated);
  addLog("validate", `Validation verdict: ${validationResult.verdict} (confidence: ${validationResult.confidenceScore.toFixed(2)})`);

  // Step 10: Analyze if needed
  let analysisResult: ExperimentAnalysisResult | null = null;
  if (validationResult.verdict !== "pass") {
    analysisResult = analyzeExperimentFailure(currentGroup, aggregated, validationResult);
    addLog("analyze", `Analysis: ${analysisResult.primaryRecommendation} (top cause: ${analysisResult.rootCauses[0]?.category ?? "unknown"})`);
  }

  const finalStatus = validationResult.verdict === "pass"
    ? "validated" as const
    : validationResult.verdict === "inconclusive"
      ? "inconclusive" as const
      : currentGroup.status === "partially_failed"
        ? "partially_failed" as const
        : "failed" as const;

  addLog("complete", `Grouped pipeline finished: ${finalStatus}`);

  return {
    experimentId: parentSpec.experimentId,
    group: currentGroup,
    aggregated,
    validationResult,
    analysisResult,
    dataResults,
    preprocessingResult,
    status: finalStatus,
    log,
  };
}

function makeFailedGroupResult(
  experimentId: string,
  dataResults: DatasetAcquisitionResult[],
  preprocessingResult: PreprocessingRunResult | null,
  log: PipelineLogEntry[],
): GroupedPipelineResult {
  return {
    experimentId,
    group: {
      groupId: "failed",
      sessionId: "",
      roundNumber: 0,
      parentSpec: {} as ExperimentSpec,
      decompositionStrategy: "custom",
      workers: [],
      dependencyGraph: {},
      aggregationRules: { metricAggregation: "mean", minSuccessRate: 0, metricsToAggregate: [], computeVariance: false, maxCoefficientOfVariation: null, customAggregator: null },
      validationCriteria: { metricThresholds: [], requiredArtifacts: [], minSuccessfulWorkers: 0, maxVariance: null, baselineRequired: false, baselineMetrics: {}, customConditions: [] },
      status: "failed",
      aggregatedResult: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    },
    aggregated: null,
    validationResult: null,
    analysisResult: null,
    dataResults,
    preprocessingResult,
    status: "failed",
    log,
  };
}

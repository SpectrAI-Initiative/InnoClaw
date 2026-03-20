// =============================================================
// Execution Pipeline — Readiness Checker
// =============================================================
// Determines whether a research plan is ready for execution.
// Used by the Main Brain to reason about what's missing.

import type {
  ExperimentSpec,
  DataSourceSpec,
  ExperimentResources,
  ExecutionPipelineConfig,
  DryRunResult,
  PreprocessingStepSpec,
} from "./types";
import { renderJobSpec } from "./exec-job-submitter";

// -------------------------------------------------------------------
// Readiness check
// -------------------------------------------------------------------

export interface ReadinessReport {
  ready: boolean;
  blockers: ReadinessBlocker[];
  warnings: string[];
  /** Whether a dry-run spec can be generated now. */
  canDryRun: boolean;
  /** Whether preprocessing needs to run first. */
  needsPreprocessing: boolean;
  /** Whether datasets need to be fetched first. */
  needsDataFetch: boolean;
  /** Scale classification. */
  scale: string;
  /** Summary of required resources. */
  resourceSummary: string;
  /** Summary of required datasets. */
  datasetSummary: string;
  /** Commands that will be executed. */
  commandSummary: string[];
}

export interface ReadinessBlocker {
  field: string;
  issue: string;
  suggestion: string;
}

/**
 * Check whether an ExperimentSpec is ready for execution.
 */
export function checkExecutionReadiness(
  spec: ExperimentSpec,
  config: ExecutionPipelineConfig,
): ReadinessReport {
  const blockers: ReadinessBlocker[] = [];
  const warnings: string[] = [];

  // Check experiment basics
  if (!spec.experimentId) {
    blockers.push({ field: "experimentId", issue: "Missing experiment ID", suggestion: "Generate a unique experiment ID" });
  }
  if (!spec.name) {
    blockers.push({ field: "name", issue: "Missing experiment name", suggestion: "Provide a descriptive name" });
  }
  if (spec.commands.length === 0) {
    blockers.push({ field: "commands", issue: "No commands specified", suggestion: "Add train/eval commands" });
  }

  // Check data sources
  for (const ds of spec.dataSources) {
    if (!ds.identifier) {
      blockers.push({ field: `dataSource.${ds.id}`, issue: `Data source ${ds.id} has no identifier`, suggestion: "Specify dataset identifier" });
    }
    if (!ds.cachePath) {
      blockers.push({ field: `dataSource.${ds.id}.cachePath`, issue: `No cache path for ${ds.id}`, suggestion: "Set cache path in config" });
    }
  }

  // Check resources
  if (spec.resources.gpu <= 0 && spec.taskType !== "eval_only" && spec.taskType !== "data_only") {
    warnings.push("No GPU requested — this may be intentional for CPU-only tasks");
  }
  if (spec.resources.memoryMb < 16000) {
    warnings.push(`Low memory (${spec.resources.memoryMb} MB) — may cause OOM`);
  }

  // Check preprocessing
  const needsPreprocessing = spec.preprocessing.enabled && spec.preprocessing.steps.length > 0;
  if (needsPreprocessing) {
    for (const step of spec.preprocessing.steps) {
      if (!step.name) {
        blockers.push({ field: `preprocessing.step.${step.order}`, issue: "Step has no name", suggestion: "Name each preprocessing step" });
      }
    }
    if (!spec.preprocessing.outputPath) {
      blockers.push({ field: "preprocessing.outputPath", issue: "No preprocessing output path", suggestion: "Set preprocessing output path" });
    }
  }

  // Check environment
  if (!spec.environment.workingDir) {
    warnings.push("No working directory set — using default");
  }

  // Check outputs
  if (!spec.outputs.baseDir) {
    blockers.push({ field: "outputs.baseDir", issue: "No output base directory", suggestion: "Set experiment output directory" });
  }

  // Check commands have valid stages
  for (const cmd of spec.commands) {
    if (!["setup", "train", "eval", "postprocess"].includes(cmd.stage)) {
      warnings.push(`Command "${cmd.name}" has unknown stage "${cmd.stage}"`);
    }
  }

  // Build summaries
  const needsDataFetch = spec.dataSources.some(ds => ds.source !== "local");
  const canDryRun = blockers.length === 0;

  const resourceSummary = [
    `${spec.resources.gpu} GPU${spec.resources.gpuType ? ` (${spec.resources.gpuType})` : ""}`,
    `${spec.resources.cpu} CPU`,
    `${spec.resources.memoryMb} MB RAM`,
    `${spec.resources.walltime} walltime`,
  ].join(", ");

  const datasetSummary = spec.dataSources.length === 0
    ? "No datasets"
    : spec.dataSources.map(ds => `${ds.name} (${ds.source}: ${ds.identifier})`).join(", ");

  const commandSummary = spec.commands.map(c => `[${c.stage}] ${c.command} ${c.args.join(" ")}`);

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    canDryRun,
    needsPreprocessing,
    needsDataFetch,
    scale: spec.scale,
    resourceSummary,
    datasetSummary,
    commandSummary,
  };
}

// -------------------------------------------------------------------
// Dry-run generator
// -------------------------------------------------------------------

/**
 * Generate a dry-run result showing exactly what would happen without actually doing it.
 */
export function generateDryRun(
  spec: ExperimentSpec,
  config: ExecutionPipelineConfig,
): DryRunResult {
  const readiness = checkExecutionReadiness(spec, config);

  const renderedCommands = spec.commands.map(c => `${c.command} ${c.args.join(" ")}`);

  return {
    experimentId: spec.experimentId,
    mode: "dry_run",
    renderedJobSpec: renderJobSpec(spec),
    renderedCommands,
    estimatedResources: spec.resources,
    dataRequirements: spec.dataSources,
    preprocessingSteps: spec.preprocessing.steps,
    warnings: readiness.warnings,
    blockers: readiness.blockers.map(b => `${b.field}: ${b.issue}`),
    readyToSubmit: readiness.ready,
  };
}

// -------------------------------------------------------------------
// Resource estimation helpers
// -------------------------------------------------------------------

/**
 * Estimate GPU hours based on dataset size and task type.
 */
export function estimateGPUHours(
  datasetSizeGb: number,
  taskType: string,
  scale: string,
): number {
  const scaleMultiplier = scale === "pilot" ? 0.1 : scale === "full" ? 1.0 : 0.5;

  const baseHours: Record<string, number> = {
    training: datasetSizeGb * 10,
    fine_tuning: datasetSizeGb * 5,
    evaluation: datasetSizeGb * 1,
    preprocessing: datasetSizeGb * 0.5,
  };

  const base = baseHours[taskType] ?? datasetSizeGb * 5;
  return Math.max(1, Math.ceil(base * scaleMultiplier));
}

/**
 * Suggest resources based on experiment parameters.
 */
export function suggestResources(
  datasetSizeGb: number,
  modelParams: string,
  scale: string,
): Partial<ExperimentResources> {
  // Parse model size (e.g., "7B" → 7)
  const paramMatch = modelParams.match(/([\d.]+)\s*[BbMm]/);
  const paramBillions = paramMatch ? parseFloat(paramMatch[1]) : 1;

  const gpuCount = paramBillions >= 13 ? 8 : paramBillions >= 7 ? 4 : paramBillions >= 3 ? 2 : 1;
  const memoryMb = Math.max(64_000, Math.ceil(paramBillions * 20_000));

  const hours = estimateGPUHours(datasetSizeGb, "training", scale);
  const walltime = `${Math.min(72, hours)}:00:00`;

  return {
    gpu: scale === "pilot" ? Math.min(gpuCount, 2) : gpuCount,
    memoryMb: scale === "pilot" ? Math.min(memoryMb, 128_000) : memoryMb,
    cpu: Math.max(8, gpuCount * 8),
    walltime,
    privateMachine: gpuCount >= 4 ? "yes" : "no",
  };
}

// -------------------------------------------------------------------
// Pilot / full-scale templates
// -------------------------------------------------------------------

/**
 * Create a pilot-scale version of an experiment spec.
 */
export function toPilotSpec(spec: ExperimentSpec): ExperimentSpec {
  return {
    ...spec,
    scale: "pilot",
    name: `[PILOT] ${spec.name}`,
    resources: {
      ...spec.resources,
      gpu: Math.min(spec.resources.gpu, 2),
      memoryMb: Math.min(spec.resources.memoryMb, 128_000),
      walltime: "4:00:00",
    },
    commands: spec.commands.map(cmd => ({
      ...cmd,
      args: [...cmd.args, "--max_steps=100", "--eval_steps=50"],
    })),
    retryPolicy: { ...spec.retryPolicy, maxRetries: 0 },
  };
}

/**
 * Create a full-scale version from a pilot spec.
 */
export function toFullSpec(
  pilotSpec: ExperimentSpec,
  fullResources: Partial<ExperimentResources>,
): ExperimentSpec {
  return {
    ...pilotSpec,
    scale: "full",
    name: pilotSpec.name.replace("[PILOT] ", ""),
    resources: {
      ...pilotSpec.resources,
      ...fullResources,
    },
    commands: pilotSpec.commands.map(cmd => ({
      ...cmd,
      args: cmd.args.filter(a => !a.startsWith("--max_steps=") && !a.startsWith("--eval_steps=")),
    })),
  };
}

// =============================================================
// Execution Pipeline — Configuration
// =============================================================
// Structured configuration for the execution pipeline.
// Merges user overrides with sensible defaults.

import type {
  ExecutionPipelineConfig,
  ExperimentResources,
  EnvironmentSetup,
} from "./types";
import { DEFAULT_EXECUTION_PIPELINE_CONFIG } from "./types";

export { DEFAULT_EXECUTION_PIPELINE_CONFIG } from "./types";

export type ExecutionPipelineConfigOverrides = Partial<ExecutionPipelineConfig>;

/**
 * Merge user overrides with defaults.
 */
export function resolveConfig(
  overrides?: ExecutionPipelineConfigOverrides,
): ExecutionPipelineConfig {
  const defaults = DEFAULT_EXECUTION_PIPELINE_CONFIG;
  if (!overrides) {
    return { ...defaults };
  }

  return {
    dataCacheDir: overrides.dataCacheDir ?? defaults.dataCacheDir,
    experimentOutputRoot: overrides.experimentOutputRoot ?? defaults.experimentOutputRoot,
    preprocessingOutputRoot: overrides.preprocessingOutputRoot ?? defaults.preprocessingOutputRoot,
    defaultLauncherType: overrides.defaultLauncherType ?? defaults.defaultLauncherType,
    defaultResources: {
      ...defaults.defaultResources,
      ...(overrides.defaultResources ?? {}),
    },
    defaultMounts: overrides.defaultMounts ?? defaults.defaultMounts,
    chargedGroup: overrides.chargedGroup ?? defaults.chargedGroup,
    defaultEnvironment: {
      ...defaults.defaultEnvironment,
      ...(overrides.defaultEnvironment ?? {}),
    },
    defaultRetryPolicy: {
      ...defaults.defaultRetryPolicy,
      ...(overrides.defaultRetryPolicy ?? {}),
    },
    skipExistingData: overrides.skipExistingData ?? defaults.skipExistingData,
    skipExistingPreprocessing: overrides.skipExistingPreprocessing ?? defaults.skipExistingPreprocessing,
  };
}

/**
 * Merge per-experiment resource overrides with defaults.
 */
export function resolveResources(
  defaults: ExperimentResources,
  overrides?: Partial<ExperimentResources>,
): ExperimentResources {
  if (!overrides) return { ...defaults };
  return {
    gpu: overrides.gpu ?? defaults.gpu,
    gpuType: overrides.gpuType ?? defaults.gpuType,
    cpu: overrides.cpu ?? defaults.cpu,
    memoryMb: overrides.memoryMb ?? defaults.memoryMb,
    diskGb: overrides.diskGb ?? defaults.diskGb,
    walltime: overrides.walltime ?? defaults.walltime,
    privateMachine: overrides.privateMachine ?? defaults.privateMachine,
    maxWaitDuration: overrides.maxWaitDuration ?? defaults.maxWaitDuration,
  };
}

/**
 * Resolve environment setup with defaults.
 */
export function resolveEnvironment(
  defaults: Partial<EnvironmentSetup>,
  overrides?: Partial<EnvironmentSetup>,
): EnvironmentSetup {
  return {
    modules: overrides?.modules ?? (defaults.modules as string[]) ?? [],
    envVars: { ...(defaults.envVars ?? {}), ...(overrides?.envVars ?? {}) },
    condaEnv: overrides?.condaEnv ?? defaults.condaEnv,
    venvPath: overrides?.venvPath ?? defaults.venvPath,
    setupCommands: [
      ...((defaults.setupCommands as string[]) ?? []),
      ...((overrides?.setupCommands as string[]) ?? []),
    ],
    workingDir: overrides?.workingDir ?? (defaults.workingDir as string) ?? "/tmp",
  };
}

/**
 * Generate cache path for a dataset source.
 */
export function datasetCachePath(config: ExecutionPipelineConfig, sourceId: string): string {
  return `${config.dataCacheDir}/${sourceId}`;
}

/**
 * Generate output path for an experiment.
 */
export function experimentOutputPath(config: ExecutionPipelineConfig, experimentId: string): string {
  return `${config.experimentOutputRoot}/${experimentId}`;
}

/**
 * Generate preprocessing output path.
 */
export function preprocessingOutputPath(config: ExecutionPipelineConfig, experimentId: string): string {
  return `${config.preprocessingOutputRoot}/${experimentId}`;
}

// =============================================================
// Deep Research — Execution Adapters
// =============================================================
// Structured builders for rlaunch / rjob execution manifests.
// These are NOT raw string-only — every field is typed and configurable.

import type {
  ExecutionManifest,
  RLaunchManifest,
  RJobManifest,
  MountSpec,
  LauncherType,
  ExecutionConfig,
  ValidationStep,
} from "./types";
import { DEFAULT_EXECUTION_CONFIG } from "./types";

// -------------------------------------------------------------------
// Manifest Builders
// -------------------------------------------------------------------

export interface RLaunchOptions {
  gpu?: number;
  memoryMb?: number;
  cpu?: number;
  chargedGroup?: string;
  privateMachine?: "yes" | "no" | "group";
  mounts?: MountSpec[];
  maxWaitDuration?: string;
  command: string;
  purpose: string;
}

/**
 * Build a structured rlaunch manifest from options + defaults.
 * Template pattern:
 *   rlaunch --gpu=2 --memory=400000 --cpu=32 --charged-group=ai4sdata_gpu
 *           --private-machine=yes --mount=... --max-wait-duration=60m0s -- bash
 */
export function buildRLaunchManifest(
  options: RLaunchOptions,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
): RLaunchManifest {
  return {
    launcherType: "rlaunch",
    gpu: options.gpu ?? config.defaultResources.gpu,
    memoryMb: options.memoryMb ?? config.defaultResources.memoryMb,
    cpu: options.cpu ?? config.defaultResources.cpu,
    chargedGroup: options.chargedGroup ?? config.defaultChargedGroup,
    privateMachine: options.privateMachine ?? config.defaultResources.privateMachine,
    mounts: options.mounts ?? config.defaultMounts,
    maxWaitDuration: options.maxWaitDuration ?? config.defaultResources.maxWaitDuration ?? "60m0s",
    command: options.command,
    purpose: options.purpose,
  };
}

export interface RJobOptions {
  jobName: string;
  gpu?: number;
  memoryMb?: number;
  cpu?: number;
  chargedGroup?: string;
  privateMachine?: "yes" | "no" | "group";
  mounts?: MountSpec[];
  image: string;
  command: string;
  commandArgs?: string[];
  env?: Record<string, string>;
  priority?: number;
  hostNetwork?: boolean;
  purpose: string;
}

/**
 * Build a structured rjob submission manifest from options + defaults.
 * Template pattern:
 *   rjob submit --name=train-go-bp-3ep --gpu=4 --memory=200000 --cpu=32
 *               --mount=... --image=... --charged-group=ai4sdata_gpu
 *               --private-machine=group -- bash -exc "..."
 */
export function buildRJobManifest(
  options: RJobOptions,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
): RJobManifest {
  return {
    launcherType: "rjob",
    jobName: options.jobName,
    gpu: options.gpu ?? config.defaultResources.gpu,
    memoryMb: options.memoryMb ?? config.defaultResources.memoryMb,
    cpu: options.cpu ?? config.defaultResources.cpu,
    chargedGroup: options.chargedGroup ?? config.defaultChargedGroup,
    privateMachine: options.privateMachine ?? config.defaultResources.privateMachine,
    mounts: options.mounts ?? config.defaultMounts,
    image: options.image,
    command: options.command,
    commandArgs: options.commandArgs ?? [],
    env: options.env,
    priority: options.priority,
    hostNetwork: options.hostNetwork,
    purpose: options.purpose,
  };
}

// -------------------------------------------------------------------
// Command Serialization (for display and submission)
// -------------------------------------------------------------------

/**
 * Convert an rlaunch manifest to a sanitized, human-readable command string.
 */
export function rlaunchToCommand(manifest: RLaunchManifest): string {
  const parts = ["rlaunch"];
  parts.push(`--gpu=${manifest.gpu}`);
  parts.push(`--memory=${manifest.memoryMb}`);
  parts.push(`--cpu=${manifest.cpu}`);
  parts.push(`--charged-group=${manifest.chargedGroup}`);
  parts.push(`--private-machine=${manifest.privateMachine}`);
  for (const mount of manifest.mounts) {
    parts.push(`--mount=${mount.source}:${mount.target}`);
  }
  if (manifest.maxWaitDuration) {
    parts.push(`--max-wait-duration=${manifest.maxWaitDuration}`);
  }
  parts.push("--");
  parts.push(manifest.command);
  return parts.join(" \\\n  ");
}

/**
 * Convert an rjob manifest to a sanitized, human-readable command string.
 */
export function rjobToCommand(manifest: RJobManifest): string {
  const parts = ["rjob submit"];
  parts.push(`--name=${manifest.jobName}`);
  parts.push(`--gpu=${manifest.gpu}`);
  parts.push(`--memory=${manifest.memoryMb}`);
  parts.push(`--cpu=${manifest.cpu}`);
  for (const mount of manifest.mounts) {
    parts.push(`--mount=${mount.source}:${mount.target}`);
  }
  parts.push(`--image=${manifest.image}`);
  parts.push(`--charged-group=${manifest.chargedGroup}`);
  if (manifest.privateMachine) {
    parts.push(`--private-machine=${manifest.privateMachine}`);
  }
  if (manifest.priority !== undefined) {
    parts.push(`--priority=${manifest.priority}`);
  }
  if (manifest.hostNetwork) {
    parts.push("--host-network");
  }
  if (manifest.env) {
    for (const [key, value] of Object.entries(manifest.env)) {
      parts.push(`--env=${key}=${value}`);
    }
  }
  parts.push("--");
  parts.push(manifest.command);
  if (manifest.commandArgs.length > 0) {
    parts.push(manifest.commandArgs.join(" "));
  }
  return parts.join(" \\\n  ");
}

/**
 * Convert any execution manifest to a sanitized command string.
 */
export function manifestToCommand(manifest: ExecutionManifest): string {
  switch (manifest.launcherType) {
    case "rlaunch":
      return rlaunchToCommand(manifest);
    case "rjob":
      return rjobToCommand(manifest);
    case "slurm": {
      // Dynamic import not possible here; use registry fallback
      const slurmAdapter = getLauncher("slurm" as unknown as LauncherType);
      if (slurmAdapter) return slurmAdapter.toCommand(manifest);
      return `[Slurm manifest — register slurm-launcher to serialize]`;
    }
    default:
      return `[Unknown launcher type: ${(manifest as { launcherType: string }).launcherType}]`;
  }
}

// -------------------------------------------------------------------
// Validation Step → Execution Manifest
// -------------------------------------------------------------------

/**
 * Convert a validation step into an execution manifest.
 * The main brain or workers call this when preparing execution nodes.
 */
export function validationStepToManifest(
  step: ValidationStep,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
): ExecutionManifest | null {
  if (!step.command && !step.scriptPath) return null;

  const command = step.command || `bash ${step.scriptPath}`;
  const launcherType = step.launcherType ?? config.defaultLauncherType;

  switch (launcherType) {
    case "rlaunch":
      return buildRLaunchManifest({
        command,
        purpose: step.description,
      }, config);
    case "rjob":
      return buildRJobManifest({
        jobName: `dr-step-${step.stepNumber}`,
        image: "registry.h.pjlab.org.cn/ailab-ai4sdata-ai4sdata_gpu/swift:ubuntu22.04-cuda12.9.1-py311-torch2.8.0-vllm0.11.0-modelscope1.32.0-swift3.11.3",
        command: "bash",
        commandArgs: ["-exc", command],
        purpose: step.description,
      }, config);
    default:
      return null;
  }
}

// -------------------------------------------------------------------
// Launcher Type Registry (extensible)
// -------------------------------------------------------------------

export interface LauncherAdapter {
  type: LauncherType;
  label: string;
  description: string;
  buildManifest: (options: Record<string, unknown>, config: ExecutionConfig) => ExecutionManifest;
  toCommand: (manifest: ExecutionManifest) => string;
}

const launcherRegistry = new Map<LauncherType, LauncherAdapter>();

export function registerLauncher(adapter: LauncherAdapter): void {
  launcherRegistry.set(adapter.type, adapter);
}

export function getLauncher(type: LauncherType): LauncherAdapter | undefined {
  return launcherRegistry.get(type);
}

export function getAvailableLaunchers(): LauncherAdapter[] {
  return Array.from(launcherRegistry.values());
}

// Register built-in launchers
registerLauncher({
  type: "rlaunch",
  label: "rlaunch",
  description: "Request a development machine with GPU resources",
  buildManifest: (opts, config) => buildRLaunchManifest(opts as unknown as RLaunchOptions, config),
  toCommand: (m) => rlaunchToCommand(m as RLaunchManifest),
});

registerLauncher({
  type: "rjob",
  label: "rjob submit",
  description: "Submit a training/experiment job to the cluster",
  buildManifest: (opts, config) => buildRJobManifest(opts as unknown as RJobOptions, config),
  toCommand: (m) => rjobToCommand(m as RJobManifest),
});

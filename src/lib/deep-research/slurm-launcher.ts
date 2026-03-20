// =============================================================
// Deep Research — Slurm Launcher Adapter
// =============================================================
// Provides Slurm/sbatch job submission support as a fallback
// when rjob is not available. Generates SBATCH scripts and commands.

import type {
  SlurmManifest,
  ExecutionConfig,
} from "./types";
import { DEFAULT_EXECUTION_CONFIG } from "./types";
import { registerLauncher } from "./execution-adapters";

// -------------------------------------------------------------------
// Options
// -------------------------------------------------------------------

export interface SlurmOptions {
  jobName: string;
  partition?: string;
  account?: string;
  nodes?: number;
  gpusPerNode?: number;
  time?: string;
  modules?: string[];
  command: string;
  outputPath?: string;
  errorPath?: string;
  purpose: string;
  /** Extra SBATCH directives as key-value pairs. */
  extraDirectives?: Record<string, string>;
  /** Environment variables to set. */
  env?: Record<string, string>;
  /** Working directory. */
  workdir?: string;
}

// -------------------------------------------------------------------
// Manifest builder
// -------------------------------------------------------------------

/**
 * Build a structured Slurm manifest from options + defaults.
 */
export function buildSlurmManifest(
  options: SlurmOptions,
  config: ExecutionConfig = DEFAULT_EXECUTION_CONFIG,
): SlurmManifest {
  return {
    launcherType: "slurm",
    jobName: options.jobName,
    partition: options.partition ?? "gpu",
    account: options.account ?? config.defaultChargedGroup ?? "default",
    nodes: options.nodes ?? 1,
    gpusPerNode: options.gpusPerNode ?? config.defaultResources.gpu,
    time: options.time ?? "24:00:00",
    modules: options.modules ?? [],
    command: options.command,
    outputPath: options.outputPath ?? `slurm-%j-${options.jobName}.out`,
    errorPath: options.errorPath ?? `slurm-%j-${options.jobName}.err`,
  };
}

// -------------------------------------------------------------------
// Script generation
// -------------------------------------------------------------------

/**
 * Convert a Slurm manifest to a full sbatch script (#!/bin/bash header + #SBATCH directives).
 */
export function slurmToScript(manifest: SlurmManifest): string {
  const lines: string[] = [];

  lines.push("#!/bin/bash");
  lines.push(`#SBATCH --job-name=${manifest.jobName ?? "deep-research-job"}`);
  lines.push(`#SBATCH --partition=${manifest.partition}`);
  lines.push(`#SBATCH --account=${manifest.account}`);
  lines.push(`#SBATCH --nodes=${manifest.nodes}`);
  lines.push(`#SBATCH --gres=gpu:${manifest.gpusPerNode}`);
  lines.push(`#SBATCH --time=${manifest.time}`);

  if (manifest.outputPath) {
    lines.push(`#SBATCH --output=${manifest.outputPath}`);
  }
  if (manifest.errorPath) {
    lines.push(`#SBATCH --error=${manifest.errorPath}`);
  }

  lines.push("");

  // Module loads
  if (manifest.modules.length > 0) {
    lines.push("# Load modules");
    for (const mod of manifest.modules) {
      lines.push(`module load ${mod}`);
    }
    lines.push("");
  }

  // Environment info
  lines.push("# Print environment info");
  lines.push("echo \"Job ID: $SLURM_JOB_ID\"");
  lines.push("echo \"Node: $SLURM_NODELIST\"");
  lines.push("echo \"GPUs: $CUDA_VISIBLE_DEVICES\"");
  lines.push("echo \"Start time: $(date)\"");
  lines.push("");

  // Main command
  lines.push("# Main command");
  lines.push(manifest.command);
  lines.push("");
  lines.push("echo \"End time: $(date)\"");

  return lines.join("\n");
}

/**
 * Convert a Slurm manifest to an sbatch command invocation.
 */
export function slurmToCommand(manifest: SlurmManifest): string {
  const parts = ["sbatch"];
  parts.push(`--job-name=${manifest.jobName ?? "deep-research-job"}`);
  parts.push(`--partition=${manifest.partition}`);
  parts.push(`--account=${manifest.account}`);
  parts.push(`--nodes=${manifest.nodes}`);
  parts.push(`--gres=gpu:${manifest.gpusPerNode}`);
  parts.push(`--time=${manifest.time}`);

  if (manifest.outputPath) {
    parts.push(`--output=${manifest.outputPath}`);
  }
  if (manifest.errorPath) {
    parts.push(`--error=${manifest.errorPath}`);
  }

  // For inline commands, wrap in --wrap
  parts.push(`--wrap="${manifest.command.replace(/"/g, '\\"')}"`);

  return parts.join(" \\\n  ");
}

/**
 * Generate an srun command for interactive/allocation-based execution.
 */
export function slurmToSrun(manifest: SlurmManifest): string {
  const parts = ["srun"];
  parts.push(`--partition=${manifest.partition}`);
  parts.push(`--account=${manifest.account}`);
  parts.push(`--nodes=${manifest.nodes}`);
  parts.push(`--gres=gpu:${manifest.gpusPerNode}`);
  parts.push(`--time=${manifest.time}`);
  parts.push(`--job-name=${manifest.jobName ?? "deep-research-job"}`);
  parts.push(manifest.command);

  return parts.join(" \\\n  ");
}

/**
 * Generate an salloc command for resource allocation.
 */
export function slurmToSalloc(manifest: SlurmManifest): string {
  const parts = ["salloc"];
  parts.push(`--partition=${manifest.partition}`);
  parts.push(`--account=${manifest.account}`);
  parts.push(`--nodes=${manifest.nodes}`);
  parts.push(`--gres=gpu:${manifest.gpusPerNode}`);
  parts.push(`--time=${manifest.time}`);
  parts.push(`--job-name=${manifest.jobName ?? "deep-research-job"}`);

  return parts.join(" \\\n  ");
}

// -------------------------------------------------------------------
// Launcher registration
// -------------------------------------------------------------------

// Register the Slurm launcher in the global launcher registry
// Note: We cast to satisfy the LauncherAdapter interface which uses LauncherType.
// The SlurmManifest is a valid ExecutionManifest after types.ts update.
registerLauncher({
  type: "slurm" as unknown as "rlaunch",
  label: "sbatch (Slurm)",
  description: "Submit a batch job via Slurm scheduler (sbatch/srun fallback)",
  buildManifest: (opts, config) => buildSlurmManifest(opts as unknown as SlurmOptions, config) as unknown as import("./types").ExecutionManifest,
  toCommand: (m) => slurmToCommand(m as unknown as SlurmManifest),
});

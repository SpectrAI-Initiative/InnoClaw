// =============================================================
// Execution Pipeline — Job Submission Layer
// =============================================================
// Provides a SubmissionAdapter interface with real (rjob/slurm) and
// mock implementations. Separates spec generation from actual submission.

import type {
  ExperimentSpec,
  MountSpec,
  EnvironmentSetup,
  JobSubmissionResult,
  JobStatusResult,
  JobLogResult,
  JobOutputResult,
  JobStatus,
  SubmissionMode,
  LauncherType,
  RJobManifest,
  RLaunchManifest,
  SlurmManifest,
  ExecutionManifest,
} from "./types";
import { rjobToCommand, rlaunchToCommand } from "./execution-adapters";
import { slurmToScript } from "./slurm-launcher";

// -------------------------------------------------------------------
// Adapter interface
// -------------------------------------------------------------------

export interface SubmissionAdapter {
  readonly name: string;
  readonly launcherType: LauncherType;

  /** Render the job spec as a human-readable string. */
  renderSpec(spec: ExperimentSpec): string;

  /** Submit a job. In mock mode, returns a fake result. */
  submit(spec: ExperimentSpec, mode: SubmissionMode): Promise<JobSubmissionResult>;

  /** Query job status. */
  queryStatus(jobId: string): Promise<JobStatusResult>;

  /** Cancel a running job. */
  cancel(jobId: string): Promise<{ success: boolean; message: string }>;

  /** Fetch logs from a completed/running job (optional). */
  fetchLogs?(jobId: string): Promise<JobLogResult>;

  /** Fetch output files and metrics from a job (optional). */
  fetchOutputs?(outputDir: string): Promise<JobOutputResult>;
}

// -------------------------------------------------------------------
// Spec rendering helpers (shared)
// -------------------------------------------------------------------

/**
 * Build an rjob manifest from an ExperimentSpec.
 */
export function specToRJobManifest(spec: ExperimentSpec): RJobManifest {
  const envSetup = buildSetupScript(spec.environment);
  const mainCommands = spec.commands
    .filter(c => c.stage === "train" || c.stage === "eval")
    .map(c => [c.command, ...c.args].join(" "));
  const fullCommand = [envSetup, ...mainCommands].filter(Boolean).join(" && ");

  return {
    launcherType: "rjob",
    jobName: spec.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
    gpu: spec.resources.gpu,
    memoryMb: spec.resources.memoryMb,
    cpu: spec.resources.cpu,
    chargedGroup: "", // Filled by adapter from config
    privateMachine: spec.resources.privateMachine,
    mounts: spec.mounts,
    image: spec.environment.condaEnv
      ? `registry.example.com/research:conda-${spec.environment.condaEnv}`
      : "registry.example.com/research:latest",
    command: "bash",
    commandArgs: ["-exc", fullCommand],
    env: spec.environment.envVars,
    purpose: spec.description,
  };
}

/**
 * Build an rlaunch manifest from an ExperimentSpec.
 */
export function specToRLaunchManifest(spec: ExperimentSpec): RLaunchManifest {
  const envSetup = buildSetupScript(spec.environment);
  const mainCommands = spec.commands
    .filter(c => c.stage === "train" || c.stage === "eval")
    .map(c => [c.command, ...c.args].join(" "));
  const fullCommand = [envSetup, ...mainCommands].filter(Boolean).join(" && ");

  return {
    launcherType: "rlaunch",
    gpu: spec.resources.gpu,
    memoryMb: spec.resources.memoryMb,
    cpu: spec.resources.cpu,
    chargedGroup: "",
    privateMachine: spec.resources.privateMachine,
    mounts: spec.mounts,
    maxWaitDuration: spec.resources.maxWaitDuration ?? "2h",
    command: fullCommand,
    purpose: spec.description,
  };
}

/**
 * Build a Slurm manifest from an ExperimentSpec.
 */
export function specToSlurmManifest(spec: ExperimentSpec): SlurmManifest {
  const envSetup = buildSetupScript(spec.environment);
  const mainCommands = spec.commands
    .filter(c => c.stage === "train" || c.stage === "eval")
    .map(c => [c.command, ...c.args].join(" "));
  const fullCommand = [envSetup, ...mainCommands].filter(Boolean).join(" && ");

  return {
    launcherType: "slurm",
    partition: "gpu",
    account: "",
    nodes: 1,
    gpusPerNode: spec.resources.gpu,
    time: spec.resources.walltime,
    modules: spec.environment.modules,
    command: fullCommand,
    jobName: spec.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
    outputPath: `${spec.outputs.logDir}/%j.out`,
    errorPath: `${spec.outputs.logDir}/%j.err`,
  };
}

function buildSetupScript(env: EnvironmentSetup): string {
  const parts: string[] = [];
  if (env.modules.length > 0) {
    parts.push(`module load ${env.modules.join(" ")}`);
  }
  if (env.condaEnv) {
    parts.push(`conda activate ${env.condaEnv}`);
  }
  if (env.venvPath) {
    parts.push(`source ${env.venvPath}/bin/activate`);
  }
  for (const cmd of env.setupCommands) {
    parts.push(cmd);
  }
  if (env.workingDir) {
    parts.push(`cd ${env.workingDir}`);
  }
  return parts.join(" && ");
}

/**
 * Render any manifest as human-readable text.
 */
export function renderManifest(manifest: ExecutionManifest): string {
  switch (manifest.launcherType) {
    case "rjob":
      return rjobToCommand(manifest as RJobManifest);
    case "rlaunch":
      return rlaunchToCommand(manifest as RLaunchManifest);
    case "slurm":
      return slurmToScript(manifest as SlurmManifest);
    default:
      return JSON.stringify(manifest, null, 2);
  }
}

/**
 * Render an ExperimentSpec as a human-readable job spec string.
 */
export function renderJobSpec(spec: ExperimentSpec): string {
  const sections: string[] = [];

  sections.push(`# Experiment: ${spec.name}`);
  sections.push(`# ID: ${spec.experimentId}`);
  sections.push(`# Scale: ${spec.scale}`);
  sections.push(`# Launcher: ${spec.launcherType}`);
  sections.push(`# Mode: ${spec.submissionMode}`);
  sections.push("");

  // Resources
  sections.push("## Resources");
  sections.push(`GPU: ${spec.resources.gpu}${spec.resources.gpuType ? ` (${spec.resources.gpuType})` : ""}`);
  sections.push(`CPU: ${spec.resources.cpu}`);
  sections.push(`Memory: ${spec.resources.memoryMb} MB`);
  sections.push(`Walltime: ${spec.resources.walltime}`);
  sections.push(`Private: ${spec.resources.privateMachine}`);
  sections.push("");

  // Data
  if (spec.dataSources.length > 0) {
    sections.push("## Data Sources");
    for (const ds of spec.dataSources) {
      sections.push(`- ${ds.name}: ${ds.source}://${ds.identifier} → ${ds.cachePath}`);
    }
    sections.push("");
  }

  // Preprocessing
  if (spec.preprocessing.enabled) {
    sections.push("## Preprocessing");
    for (const step of spec.preprocessing.steps) {
      sections.push(`  ${step.order}. ${step.name} (${step.type}): ${step.description}`);
    }
    sections.push(`  Output: ${spec.preprocessing.outputPath}`);
    sections.push("");
  }

  // Commands
  sections.push("## Commands");
  for (const cmd of spec.commands) {
    sections.push(`  [${cmd.stage}] ${cmd.name}: ${cmd.command} ${cmd.args.join(" ")}`);
  }
  sections.push("");

  // Environment
  sections.push("## Environment");
  if (spec.environment.modules.length > 0) sections.push(`  Modules: ${spec.environment.modules.join(", ")}`);
  if (spec.environment.condaEnv) sections.push(`  Conda: ${spec.environment.condaEnv}`);
  sections.push(`  WorkDir: ${spec.environment.workingDir}`);
  sections.push("");

  // Outputs
  sections.push("## Outputs");
  sections.push(`  Base: ${spec.outputs.baseDir}`);
  sections.push(`  Checkpoints: ${spec.outputs.checkpointDir}`);
  sections.push(`  Logs: ${spec.outputs.logDir}`);
  sections.push(`  Metrics: ${spec.outputs.metricsDir}`);

  return sections.join("\n");
}

// -------------------------------------------------------------------
// Mock adapter — for testing without a real cluster
// -------------------------------------------------------------------

let mockJobCounter = 0;
const mockJobStore = new Map<string, { status: JobStatus; spec: ExperimentSpec }>();

export function resetMockState(): void {
  mockJobCounter = 0;
  mockJobStore.clear();
}

export class MockSubmissionAdapter implements SubmissionAdapter {
  readonly name = "mock";
  readonly launcherType: LauncherType = "rjob";

  /** Simulated latency in ms. */
  private latencyMs: number;

  /** Whether submissions should fail. */
  private shouldFail: boolean;

  constructor(opts?: { latencyMs?: number; shouldFail?: boolean; launcherType?: LauncherType }) {
    this.latencyMs = opts?.latencyMs ?? 0;
    this.shouldFail = opts?.shouldFail ?? false;
    if (opts?.launcherType) {
      (this as { launcherType: LauncherType }).launcherType = opts.launcherType;
    }
  }

  renderSpec(spec: ExperimentSpec): string {
    return renderJobSpec(spec);
  }

  async submit(spec: ExperimentSpec, mode: SubmissionMode): Promise<JobSubmissionResult> {
    if (this.latencyMs > 0) {
      await new Promise(r => setTimeout(r, this.latencyMs));
    }

    if (this.shouldFail) {
      return {
        success: false,
        jobId: null,
        message: "Mock submission failed (configured to fail)",
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: this.renderSpec(spec),
        metadata: { adapter: "mock", error: "configured_failure" },
      };
    }

    mockJobCounter++;
    const jobId = `mock-job-${mockJobCounter}`;
    mockJobStore.set(jobId, { status: "queued", spec });

    return {
      success: true,
      jobId,
      message: mode === "dry_run"
        ? `Dry-run: would submit ${spec.name} via ${spec.launcherType}`
        : `Mock submitted: ${spec.name} → ${jobId}`,
      submittedAt: new Date().toISOString(),
      mode,
      renderedSpec: this.renderSpec(spec),
      metadata: { adapter: "mock", jobId, scale: spec.scale },
    };
  }

  async queryStatus(jobId: string): Promise<JobStatusResult> {
    const entry = mockJobStore.get(jobId);
    if (!entry) {
      return {
        jobId,
        status: "unknown",
        message: "Job not found in mock store",
        queriedAt: new Date().toISOString(),
      };
    }

    // Simulate progression: queued → running → completed
    if (entry.status === "queued") {
      entry.status = "running";
    } else if (entry.status === "running") {
      entry.status = "completed";
    }

    return {
      jobId,
      status: entry.status,
      exitCode: entry.status === "completed" ? 0 : undefined,
      runningTimeSec: entry.status === "running" ? 120 : entry.status === "completed" ? 3600 : undefined,
      queriedAt: new Date().toISOString(),
    };
  }

  async cancel(jobId: string): Promise<{ success: boolean; message: string }> {
    const entry = mockJobStore.get(jobId);
    if (!entry) return { success: false, message: "Job not found" };
    entry.status = "cancelled";
    return { success: true, message: `Cancelled ${jobId}` };
  }

  async fetchLogs(jobId: string): Promise<JobLogResult> {
    const entry = mockJobStore.get(jobId);
    return {
      jobId,
      stdout: entry ? `[mock] Training completed for ${entry.spec.name}\nFinal loss: 0.05\nAccuracy: 0.85` : "",
      stderr: "",
      truncated: false,
      fetchedAt: new Date().toISOString(),
    };
  }

  async fetchOutputs(outputDir: string): Promise<JobOutputResult> {
    return {
      jobId: outputDir,
      files: [
        { path: `${outputDir}/metrics.json`, sizeBytes: 1024, isMetrics: true },
        { path: `${outputDir}/model.pt`, sizeBytes: 1_000_000, isMetrics: false },
      ],
      metrics: { accuracy: 0.85, loss: 0.05, f1: 0.83 },
      metricsRaw: JSON.stringify({ accuracy: 0.85, loss: 0.05, f1: 0.83 }),
      fetchedAt: new Date().toISOString(),
    };
  }
}

// -------------------------------------------------------------------
// rjob adapter — for real cluster submission
// -------------------------------------------------------------------

export class RJobSubmissionAdapter implements SubmissionAdapter {
  readonly name = "rjob";
  readonly launcherType: LauncherType = "rjob";
  private chargedGroup: string;
  private defaultMounts: MountSpec[];

  constructor(opts: { chargedGroup: string; defaultMounts?: MountSpec[] }) {
    this.chargedGroup = opts.chargedGroup;
    this.defaultMounts = opts.defaultMounts ?? [];
  }

  renderSpec(spec: ExperimentSpec): string {
    const manifest = specToRJobManifest(spec);
    manifest.chargedGroup = this.chargedGroup;
    if (manifest.mounts.length === 0) manifest.mounts = this.defaultMounts;
    return rjobToCommand(manifest);
  }

  async submit(spec: ExperimentSpec, mode: SubmissionMode): Promise<JobSubmissionResult> {
    const manifest = specToRJobManifest(spec);
    manifest.chargedGroup = this.chargedGroup;
    if (manifest.mounts.length === 0) manifest.mounts = this.defaultMounts;

    const rendered = rjobToCommand(manifest);

    if (mode === "dry_run") {
      return {
        success: true,
        jobId: null,
        message: `Dry-run: rjob spec rendered but not submitted`,
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "rjob", manifest },
      };
    }

    if (mode === "mock") {
      return new MockSubmissionAdapter().submit(spec, mode);
    }

    // Real submission: exec rjob command
    try {
      const { execSync } = await import("child_process");
      const output = execSync(rendered, {
        encoding: "utf-8",
        timeout: 30_000,
      });

      // Parse job ID from output (format varies by cluster)
      const jobIdMatch = output.match(/job[_\s-]?(?:id)?[:\s]+(\S+)/i) ??
        output.match(/(\d{5,})/);
      const jobId = jobIdMatch ? jobIdMatch[1] : `rjob-${Date.now()}`;

      return {
        success: true,
        jobId,
        message: `Submitted via rjob: ${jobId}`,
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "rjob", rawOutput: output.slice(0, 500) },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "rjob submission failed";
      return {
        success: false,
        jobId: null,
        message: msg,
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "rjob", error: msg },
      };
    }
  }

  async queryStatus(jobId: string): Promise<JobStatusResult> {
    try {
      const { execSync } = await import("child_process");
      const output = execSync(`rjob status ${jobId}`, { encoding: "utf-8", timeout: 10_000 });
      const status = parseRJobStatus(output);
      return {
        jobId,
        status,
        message: output.trim().slice(0, 200),
        queriedAt: new Date().toISOString(),
      };
    } catch {
      return {
        jobId,
        status: "unknown",
        message: "Failed to query rjob status",
        queriedAt: new Date().toISOString(),
      };
    }
  }

  async cancel(jobId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { execSync } = await import("child_process");
      execSync(`rjob cancel ${jobId}`, { encoding: "utf-8", timeout: 10_000 });
      return { success: true, message: `Cancelled rjob ${jobId}` };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Cancel failed" };
    }
  }
}

function parseRJobStatus(output: string): JobStatus {
  const lower = output.toLowerCase();
  if (lower.includes("completed") || lower.includes("finished")) return "completed";
  if (lower.includes("running")) return "running";
  if (lower.includes("pending") || lower.includes("queued")) return "queued";
  if (lower.includes("failed") || lower.includes("error")) return "failed";
  if (lower.includes("cancelled") || lower.includes("canceled")) return "cancelled";
  return "unknown";
}

// -------------------------------------------------------------------
// rlaunch adapter — for interactive GPU machine requests
// -------------------------------------------------------------------

export class RLaunchSubmissionAdapter implements SubmissionAdapter {
  readonly name = "rlaunch";
  readonly launcherType: LauncherType = "rlaunch";
  private chargedGroup: string;
  private defaultMounts: MountSpec[];

  constructor(opts: { chargedGroup: string; defaultMounts?: MountSpec[] }) {
    this.chargedGroup = opts.chargedGroup;
    this.defaultMounts = opts.defaultMounts ?? [];
  }

  renderSpec(spec: ExperimentSpec): string {
    const manifest = specToRLaunchManifest(spec);
    manifest.chargedGroup = this.chargedGroup;
    if (manifest.mounts.length === 0) manifest.mounts = this.defaultMounts;
    return rlaunchToCommand(manifest);
  }

  async submit(spec: ExperimentSpec, mode: SubmissionMode): Promise<JobSubmissionResult> {
    const manifest = specToRLaunchManifest(spec);
    manifest.chargedGroup = this.chargedGroup;
    if (manifest.mounts.length === 0) manifest.mounts = this.defaultMounts;
    const rendered = rlaunchToCommand(manifest);

    if (mode === "dry_run") {
      return {
        success: true,
        jobId: null,
        message: "Dry-run: rlaunch spec rendered but not submitted",
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "rlaunch", manifest },
      };
    }

    if (mode === "mock") {
      return new MockSubmissionAdapter({ launcherType: "rlaunch" }).submit(spec, mode);
    }

    try {
      const { execSync } = await import("child_process");
      const output = execSync(rendered, { encoding: "utf-8", timeout: 60_000 });
      const jobId = `rlaunch-${Date.now()}`;
      return {
        success: true,
        jobId,
        message: `Launched via rlaunch: ${jobId}`,
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "rlaunch", rawOutput: output.slice(0, 500) },
      };
    } catch (error) {
      return {
        success: false,
        jobId: null,
        message: error instanceof Error ? error.message : "rlaunch failed",
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "rlaunch" },
      };
    }
  }

  async queryStatus(jobId: string): Promise<JobStatusResult> {
    // rlaunch is interactive; status checking is limited
    return {
      jobId,
      status: "running",
      message: "rlaunch sessions are interactive — status check is best-effort",
      queriedAt: new Date().toISOString(),
    };
  }

  async cancel(_jobId: string): Promise<{ success: boolean; message: string }> {
    return { success: false, message: "rlaunch sessions must be terminated manually" };
  }
}

// -------------------------------------------------------------------
// Adapter registry
// -------------------------------------------------------------------

const adapterRegistry = new Map<LauncherType, () => SubmissionAdapter>();

export function registerSubmissionAdapter(
  launcherType: LauncherType,
  factory: () => SubmissionAdapter,
): void {
  adapterRegistry.set(launcherType, factory);
}

export function getSubmissionAdapter(launcherType: LauncherType): SubmissionAdapter {
  const factory = adapterRegistry.get(launcherType);
  if (factory) return factory();
  // Fallback to mock
  return new MockSubmissionAdapter({ launcherType });
}

// Pre-register adapters
registerSubmissionAdapter("rjob", () => new RJobSubmissionAdapter({
  chargedGroup: "ai4sdata_gpu",
}));
registerSubmissionAdapter("rlaunch", () => new RLaunchSubmissionAdapter({
  chargedGroup: "ai4sdata_gpu",
}));
registerSubmissionAdapter("local_shell", () => new MockSubmissionAdapter({ launcherType: "local_shell" }));

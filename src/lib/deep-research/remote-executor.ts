// =============================================================
// Remote Executor — SSH-backed execution for cluster workflows
// =============================================================
// Provides SSH remote command execution, file staging, log fetching,
// and integration with rjob/rlaunch on remote machines.

import type {
  RemoteExecutionConfig,
  ExperimentSpec,
  JobSubmissionResult,
  JobStatusResult,
  JobLogResult,
  JobOutputResult,
  JobStatus,
  SubmissionMode,
  LauncherType,
} from "./types";
import { DEFAULT_REMOTE_EXECUTION_CONFIG } from "./types";
import { specToRJobManifest, specToRLaunchManifest } from "./exec-job-submitter";
import { rjobToCommand, rlaunchToCommand } from "./execution-adapters";

// -------------------------------------------------------------------
// SSH Command Runner (injectable for testing)
// -------------------------------------------------------------------

export interface SSHCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type SSHCommandRunner = (
  config: RemoteExecutionConfig,
  command: string,
  timeoutMs?: number,
) => Promise<SSHCommandResult>;

/** Default SSH runner using child_process. */
async function defaultSSHRunner(
  config: RemoteExecutionConfig,
  command: string,
  timeoutMs?: number,
): Promise<SSHCommandResult> {
  const { execSync } = await import("child_process");
  const keyArg = config.keyPath && config.keyPath !== "agent"
    ? `-i ${config.keyPath}`
    : "";
  const sshCmd = [
    "ssh",
    `-p ${config.port}`,
    keyArg,
    "-o StrictHostKeyChecking=no",
    "-o ConnectTimeout=" + Math.ceil(config.connectTimeoutMs / 1000),
    `${config.username}@${config.host}`,
    `'${command.replace(/'/g, "'\\''")}'`,
  ].filter(Boolean).join(" ");

  try {
    const stdout = execSync(sshCmd, {
      encoding: "utf-8",
      timeout: timeoutMs ?? config.commandTimeoutMs,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.status ?? 1,
    };
  }
}

let _sshRunner: SSHCommandRunner = defaultSSHRunner;

export function setSSHRunner(runner: SSHCommandRunner): void {
  _sshRunner = runner;
}

export function resetSSHRunner(): void {
  _sshRunner = defaultSSHRunner;
}

// -------------------------------------------------------------------
// SCP File Transfer (injectable)
// -------------------------------------------------------------------

export type SCPTransfer = (
  config: RemoteExecutionConfig,
  localPath: string,
  remotePath: string,
  direction: "upload" | "download",
) => Promise<{ success: boolean; error?: string }>;

async function defaultSCPTransfer(
  config: RemoteExecutionConfig,
  localPath: string,
  remotePath: string,
  direction: "upload" | "download",
): Promise<{ success: boolean; error?: string }> {
  const { execSync } = await import("child_process");
  const keyArg = config.keyPath && config.keyPath !== "agent"
    ? `-i ${config.keyPath}`
    : "";
  const remote = `${config.username}@${config.host}:${remotePath}`;
  const cmd = direction === "upload"
    ? `scp -P ${config.port} ${keyArg} -o StrictHostKeyChecking=no -r ${localPath} ${remote}`
    : `scp -P ${config.port} ${keyArg} -o StrictHostKeyChecking=no -r ${remote} ${localPath}`;

  try {
    execSync(cmd, { encoding: "utf-8", timeout: config.commandTimeoutMs });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "SCP failed" };
  }
}

let _scpTransfer: SCPTransfer = defaultSCPTransfer;

export function setSCPTransfer(transfer: SCPTransfer): void {
  _scpTransfer = transfer;
}

export function resetSCPTransfer(): void {
  _scpTransfer = defaultSCPTransfer;
}

// -------------------------------------------------------------------
// Remote Executor Class
// -------------------------------------------------------------------

export class RemoteExecutor {
  private config: RemoteExecutionConfig;

  constructor(config: Partial<RemoteExecutionConfig>) {
    this.config = { ...DEFAULT_REMOTE_EXECUTION_CONFIG, ...config };
  }

  /** Test SSH connectivity. */
  async testConnection(): Promise<{ connected: boolean; message: string }> {
    if (!this.config.host || !this.config.username) {
      return { connected: false, message: "Missing host or username in remote config" };
    }
    try {
      const result = await _sshRunner(this.config, "echo __ALIVE__", this.config.connectTimeoutMs);
      if (result.stdout.includes("__ALIVE__")) {
        return { connected: true, message: `Connected to ${this.config.host}` };
      }
      return { connected: false, message: `Unexpected response: ${result.stdout.slice(0, 100)}` };
    } catch (error) {
      return { connected: false, message: error instanceof Error ? error.message : "Connection failed" };
    }
  }

  /** Check which launchers are available on the remote. */
  async detectLaunchers(): Promise<LauncherType[]> {
    const found: LauncherType[] = [];
    for (const launcher of ["rjob", "rlaunch", "sbatch"] as const) {
      const result = await _sshRunner(this.config, `which ${launcher} 2>/dev/null`, 10_000);
      if (result.exitCode === 0 && result.stdout.trim()) {
        if (launcher === "sbatch") found.push("slurm");
        else found.push(launcher);
      }
    }
    return found;
  }

  /** Stage files to remote working directory. */
  async stageFiles(
    localPaths: string[],
    remoteSubdir?: string,
  ): Promise<{ success: boolean; remotePaths: string[]; errors: string[] }> {
    const remoteBase = remoteSubdir
      ? `${this.config.remoteWorkDir}/${remoteSubdir}`
      : this.config.remoteWorkDir;

    // Create remote directory
    await _sshRunner(this.config, `mkdir -p ${remoteBase}`);

    const remotePaths: string[] = [];
    const errors: string[] = [];

    for (const localPath of localPaths) {
      const filename = localPath.split("/").pop() ?? localPath;
      const remotePath = `${remoteBase}/${filename}`;
      const result = await _scpTransfer(this.config, localPath, remotePath, "upload");
      if (result.success) {
        remotePaths.push(remotePath);
      } else {
        errors.push(`Failed to stage ${localPath}: ${result.error}`);
      }
    }

    return { success: errors.length === 0, remotePaths, errors };
  }

  /** Run setup commands on remote. */
  async setupEnvironment(): Promise<SSHCommandResult> {
    if (this.config.remoteSetupCommands.length === 0) {
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    const combined = this.config.remoteSetupCommands.join(" && ");
    return _sshRunner(this.config, combined);
  }

  /** Submit a job through the remote machine. */
  async submitJob(
    spec: ExperimentSpec,
    mode: SubmissionMode,
  ): Promise<JobSubmissionResult> {
    const launcher = spec.launcherType;

    if (mode === "dry_run") {
      const rendered = this.renderCommand(spec);
      return {
        success: true,
        jobId: null,
        message: `Dry-run via SSH to ${this.config.host}: ${rendered.slice(0, 200)}`,
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: rendered,
        metadata: { adapter: "ssh", host: this.config.host, launcher },
      };
    }

    const command = this.renderCommand(spec);
    const setupAndRun = this.config.remoteSetupCommands.length > 0
      ? `${this.config.remoteSetupCommands.join(" && ")} && ${command}`
      : command;

    try {
      const result = await _sshRunner(this.config, setupAndRun);

      if (result.exitCode !== 0) {
        return {
          success: false,
          jobId: null,
          message: `SSH submission failed (exit ${result.exitCode}): ${result.stderr.slice(0, 300)}`,
          submittedAt: new Date().toISOString(),
          mode,
          renderedSpec: command,
          metadata: { adapter: "ssh", host: this.config.host, stderr: result.stderr.slice(0, 500) },
        };
      }

      const jobId = parseJobIdFromOutput(result.stdout, launcher);

      return {
        success: true,
        jobId,
        message: `Submitted via SSH (${this.config.host}) → ${launcher}: ${jobId}`,
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: command,
        metadata: { adapter: "ssh", host: this.config.host, rawOutput: result.stdout.slice(0, 500) },
      };
    } catch (error) {
      return {
        success: false,
        jobId: null,
        message: error instanceof Error ? error.message : "SSH submission failed",
        submittedAt: new Date().toISOString(),
        mode,
        renderedSpec: command,
        metadata: { adapter: "ssh", host: this.config.host },
      };
    }
  }

  /** Query job status on the remote machine. */
  async queryStatus(jobId: string, launcher: LauncherType = "rjob"): Promise<JobStatusResult> {
    const cmd = launcher === "rjob"
      ? `rjob status ${jobId}`
      : launcher === "slurm"
        ? `squeue -j ${jobId} -h -o "%T"`
        : `rjob status ${jobId}`;

    try {
      const result = await _sshRunner(this.config, cmd, 15_000);
      const status = parseStatusFromOutput(result.stdout, launcher);
      return {
        jobId,
        status,
        message: result.stdout.trim().slice(0, 200),
        queriedAt: new Date().toISOString(),
      };
    } catch {
      return {
        jobId,
        status: "unknown",
        message: "Failed to query status via SSH",
        queriedAt: new Date().toISOString(),
      };
    }
  }

  /** Fetch logs from a remote job. */
  async fetchLogs(jobId: string, launcher: LauncherType = "rjob", maxLines = 500): Promise<JobLogResult> {
    const cmd = launcher === "rjob"
      ? `rjob logs ${jobId} 2>&1 | tail -${maxLines}`
      : launcher === "slurm"
        ? `tail -${maxLines} slurm-${jobId}.out 2>/dev/null; echo "---STDERR---"; tail -${maxLines} slurm-${jobId}.err 2>/dev/null`
        : `rjob logs ${jobId} 2>&1 | tail -${maxLines}`;

    try {
      const result = await _sshRunner(this.config, cmd, 30_000);
      const parts = result.stdout.split("---STDERR---");
      return {
        jobId,
        stdout: (parts[0] ?? "").trim(),
        stderr: (parts[1] ?? result.stderr).trim(),
        truncated: result.stdout.split("\n").length >= maxLines,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return {
        jobId,
        stdout: "",
        stderr: "Failed to fetch logs via SSH",
        truncated: false,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  /** Fetch output files and metrics from a remote job. */
  async fetchOutputs(outputDir: string): Promise<JobOutputResult> {
    // List files in the output directory
    const listCmd = `find ${outputDir} -type f -printf '%s %p\\n' 2>/dev/null | head -100`;
    const listResult = await _sshRunner(this.config, listCmd, 15_000);

    const files: JobOutputResult["files"] = [];
    for (const line of listResult.stdout.trim().split("\n")) {
      if (!line.trim()) continue;
      const spaceIdx = line.indexOf(" ");
      if (spaceIdx < 0) continue;
      const sizeBytes = parseInt(line.slice(0, spaceIdx), 10);
      const path = line.slice(spaceIdx + 1);
      const isMetrics = /metrics|results|scores|eval/i.test(path) && path.endsWith(".json");
      files.push({ path, sizeBytes: isNaN(sizeBytes) ? 0 : sizeBytes, isMetrics });
    }

    // Try to parse metrics from JSON files
    let metrics: Record<string, number> = {};
    let metricsRaw: string | null = null;
    const metricsFiles = files.filter(f => f.isMetrics);
    if (metricsFiles.length > 0) {
      const catCmd = `cat ${metricsFiles[0].path} 2>/dev/null`;
      const catResult = await _sshRunner(this.config, catCmd, 10_000);
      if (catResult.exitCode === 0) {
        metricsRaw = catResult.stdout;
        try {
          const parsed = JSON.parse(catResult.stdout);
          metrics = extractFlatMetrics(parsed);
        } catch { /* ignore parse errors */ }
      }
    }

    return {
      jobId: outputDir,
      files,
      metrics,
      metricsRaw,
      fetchedAt: new Date().toISOString(),
    };
  }

  /** Cancel a job on the remote machine. */
  async cancelJob(jobId: string, launcher: LauncherType = "rjob"): Promise<{ success: boolean; message: string }> {
    const cmd = launcher === "rjob"
      ? `rjob cancel ${jobId}`
      : launcher === "slurm"
        ? `scancel ${jobId}`
        : `rjob cancel ${jobId}`;

    try {
      const result = await _sshRunner(this.config, cmd, 15_000);
      return {
        success: result.exitCode === 0,
        message: result.exitCode === 0 ? `Cancelled ${jobId}` : result.stderr.slice(0, 200),
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Cancel failed" };
    }
  }

  /** Download outputs from remote to local. */
  async downloadOutputs(
    remotePath: string,
    localPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return _scpTransfer(this.config, localPath, remotePath, "download");
  }

  /** Render the submission command for a spec. */
  renderCommand(spec: ExperimentSpec): string {
    if (spec.launcherType === "rjob") {
      const manifest = specToRJobManifest(spec);
      return rjobToCommand(manifest);
    }
    if (spec.launcherType === "rlaunch") {
      const manifest = specToRLaunchManifest(spec);
      return rlaunchToCommand(manifest);
    }
    // Fallback: shell command
    const cmds = spec.commands.map(c => `${c.command} ${c.args.join(" ")}`);
    return cmds.join(" && ");
  }

  getConfig(): RemoteExecutionConfig {
    return { ...this.config };
  }
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

function parseJobIdFromOutput(output: string, launcher: LauncherType): string {
  // Try common patterns
  const patterns = [
    /job[_\s-]?id[:\s]+(\S+)/i,
    /Submitted batch job (\d+)/,
    /(\d{5,})/,
  ];
  for (const pat of patterns) {
    const match = output.match(pat);
    if (match) return match[1];
  }
  return `${launcher}-${Date.now()}`;
}

function parseStatusFromOutput(output: string, _launcher: LauncherType): JobStatus {
  const lower = output.toLowerCase().trim();
  if (lower.includes("completed") || lower.includes("finished") || lower === "cd") return "completed";
  if (lower.includes("running") || lower === "r") return "running";
  if (lower.includes("pending") || lower.includes("queued") || lower === "pd") return "queued";
  if (lower.includes("failed") || lower.includes("error") || lower === "f") return "failed";
  if (lower.includes("cancel") || lower === "ca") return "cancelled";
  return "unknown";
}

/** Extract flat numeric metrics from a possibly nested JSON object. */
function extractFlatMetrics(obj: unknown, prefix = ""): Record<string, number> {
  const result: Record<string, number> = {};
  if (obj === null || obj === undefined) return result;
  if (typeof obj === "number") {
    if (prefix) result[prefix] = obj;
    return result;
  }
  if (typeof obj !== "object") return result;
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number" && isFinite(value)) {
      result[fullKey] = value;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, extractFlatMetrics(value, fullKey));
    }
  }
  return result;
}

// -------------------------------------------------------------------
// SSH Submission Adapter (implements SubmissionAdapter interface)
// -------------------------------------------------------------------

import type { SubmissionAdapter } from "./exec-job-submitter";

// -------------------------------------------------------------------
// Profile → Config loader
// -------------------------------------------------------------------

/**
 * Load a remote profile by ID from the database and construct a
 * RemoteExecutionConfig suitable for creating a RemoteExecutor.
 * Returns null if no profile is found.
 */
export async function loadRemoteConfigFromProfile(
  profileId: string,
): Promise<RemoteExecutionConfig | null> {
  const { db } = await import("@/lib/db");
  const { remoteProfiles } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");

  const [row] = await db
    .select()
    .from(remoteProfiles)
    .where(eq(remoteProfiles.id, profileId));

  if (!row) return null;

  return {
    host: row.host,
    port: row.port,
    username: row.username,
    keyPath: row.sshKeyRef ?? "agent",
    remoteWorkDir: row.remotePath,
    remoteSetupCommands: [],
    availableLaunchers: row.schedulerType === "rjob"
      ? ["rjob"]
      : row.schedulerType === "slurm"
        ? ["slurm"]
        : ["rjob", "rlaunch"],
    connectTimeoutMs: DEFAULT_REMOTE_EXECUTION_CONFIG.connectTimeoutMs,
    commandTimeoutMs: DEFAULT_REMOTE_EXECUTION_CONFIG.commandTimeoutMs,
  };
}

/**
 * Build a RemoteExecutor from a deep-research session's bound profile.
 * Returns null if the session has no bound profile or the profile doesn't exist.
 */
export async function buildExecutorForSession(
  sessionId: string,
): Promise<RemoteExecutor | null> {
  const { getSession } = await import("./event-store");
  const session = await getSession(sessionId);
  if (!session?.remoteProfileId) return null;

  const config = await loadRemoteConfigFromProfile(session.remoteProfileId);
  if (!config) return null;

  return new RemoteExecutor(config);
}

export class SSHSubmissionAdapter implements SubmissionAdapter {
  readonly name = "ssh";
  readonly launcherType: LauncherType = "ssh";
  private executor: RemoteExecutor;
  private innerLauncher: LauncherType;

  constructor(config: Partial<RemoteExecutionConfig>, innerLauncher: LauncherType = "rjob") {
    this.executor = new RemoteExecutor(config);
    this.innerLauncher = innerLauncher;
  }

  renderSpec(spec: ExperimentSpec): string {
    return this.executor.renderCommand({ ...spec, launcherType: this.innerLauncher });
  }

  async submit(spec: ExperimentSpec, mode: SubmissionMode): Promise<JobSubmissionResult> {
    return this.executor.submitJob({ ...spec, launcherType: this.innerLauncher }, mode);
  }

  async queryStatus(jobId: string): Promise<JobStatusResult> {
    return this.executor.queryStatus(jobId, this.innerLauncher);
  }

  async cancel(jobId: string): Promise<{ success: boolean; message: string }> {
    return this.executor.cancelJob(jobId, this.innerLauncher);
  }

  async fetchLogs(jobId: string): Promise<JobLogResult> {
    return this.executor.fetchLogs(jobId, this.innerLauncher);
  }

  async fetchOutputs(outputDir: string): Promise<JobOutputResult> {
    return this.executor.fetchOutputs(outputDir);
  }

  getExecutor(): RemoteExecutor {
    return this.executor;
  }
}
